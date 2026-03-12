const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth');
const WorkOrder = require('../models/WorkOrder');
const User = require('../models/User');
const AuditLog = require('../models/AuditLog');
const { calculateSLA, checkSLABreach, calculateNextRecurrence } = require('../services/slaService');
const { webhookEvents } = require('../services/webhookService');

// @route    GET api/v1/work-orders
// @desc     Get all work orders for a company
// @access   Private
router.get('/', auth, async (req, res) => {
  try {
    let query = {};
    if (req.user.role !== 'OWNER' && req.user.role !== 'PLATFORM_OWNER') {
      query.companyId = req.user.companyId;
    }
    // TECH users: see WOs where they are lead tech OR on the crew
    if (req.user.role === 'TECH') {
      query.$or = [
        { assignedTechId: req.user.id },
        { 'additionalTechs.techId': req.user.id }
      ];
    }
    // CLIENT users: only see their client WOs
    if (req.user.role === 'CLIENT') {
      query.clientId = req.user.accountNumber;
    }
    const wos = await WorkOrder.find(query).sort({ createdAt: -1 });
    res.json(wos);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/v1/work-orders
// @desc     Create a new work order
// @access   Private
router.post('/', auth, async (req, res) => {
  try {
    const woData = { ...req.body, companyId: req.user.companyId };
    if (!woData.createdBy) woData.createdBy = req.user.id;

    // Auto-calculate SLA deadlines based on priority
    const priority = (woData.priority || 'normal').toLowerCase();
    woData.sla = calculateSLA(priority === 'emergency' || woData.emergency ? 'emergency' : priority);

    // Auto-set downtime tracking for repair WOs
    if (woData.woType === 'Repair' || woData.woType === 'Emergency') {
      woData.downtime = { reportedAt: new Date(), downtimeCategory: woData.emergency ? 'emergency' : 'unplanned' };
    }

    const wo = await WorkOrder.create(woData);

    await AuditLog.create({
      action: 'WO_CREATED',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'workOrder',
      targetId: wo._id.toString(),
      details: `Work order ${wo.woNumber} created. Type: ${wo.woType || wo.type}. SLA deadline: ${wo.sla?.deadline?.toISOString() || 'none'}`,
    });

    res.status(201).json(wo);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ═══════════════════════════════════════════════════════════════════
// ASSIGN — Drag-and-drop dispatch with capacity enforcement
// @route    PUT api/v1/work-orders/:id/assign
// @desc     Assign a WO to a tech (with capacity check)
// @access   Private (COMPANY, ADMIN, OFFICE)
// ═══════════════════════════════════════════════════════════════════
router.put('/:id/assign', auth, async (req, res) => {
  try {
    const { techId, techName } = req.body;
    if (!techId) return res.status(400).json({ msg: 'techId is required' });

    // 1. Verify the tech exists and belongs to same company
    const tech = await User.findById(techId);
    if (!tech || tech.role !== 'TECH') {
      return res.status(400).json({
        success: false, sound: 'error',
        msg: 'Invalid technician',
      });
    }
    if (tech.companyId !== req.user.companyId && req.user.role !== 'OWNER' && req.user.role !== 'PLATFORM_OWNER') {
      return res.status(403).json({
        success: false, sound: 'error',
        msg: 'Cannot assign to a tech from another company',
      });
    }

    // 2. Count active WOs for this tech
    const activeCount = await WorkOrder.countDocuments({
      assignedTechId: techId,
      status: { $in: ['Active', 'Dispatched'] },
      subStatus: { $nin: ['Completed', 'Closed'] },
    });

    const maxLimit = tech.maxActiveWOs || 5;

    // 3. CAPACITY CHECK — reject if at limit
    if (activeCount >= maxLimit) {
      // Create notification for office
      try {
        const Notification = require('../models/Notification');
        await Notification.create({
          companyId: req.user.companyId,
          userId: req.user.id,
          type: 'capacity_alert',
          title: '🚫 Tech at Capacity',
          message: `${tech.name} has ${activeCount}/${maxLimit} active WOs and cannot accept more. Please reassign.`,
          read: false,
        });
      } catch (_) { /* Notification model may not exist */ }

      await AuditLog.create({
        action: 'WO_ASSIGN_REJECTED',
        userId: req.user.id,
        companyId: req.user.companyId,
        targetType: 'workOrder',
        targetId: req.params.id,
        details: `Assignment to ${tech.name} rejected: at capacity (${activeCount}/${maxLimit})`,
      });

      return res.status(409).json({
        success: false,
        sound: 'capacityFail',
        reason: `${tech.name} has reached their WO limit (${activeCount}/${maxLimit})`,
        techName: tech.name,
        activeCount,
        maxLimit,
      });
    }

    // 4. Assign the WO
    const wo = await WorkOrder.findByIdAndUpdate(req.params.id, {
      $set: {
        assignedTechId: techId,
        assignedTechName: techName || tech.name,
        status: 'Active',
        subStatus: 'Dispatched',
        'sla.respondedAt': new Date(), // SLA first-response timestamp
      }
    }, { new: true });

    if (!wo) {
      return res.status(404).json({ success: false, sound: 'error', msg: 'Work order not found' });
    }

    await AuditLog.create({
      action: 'WO_ASSIGNED',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'workOrder',
      targetId: wo._id.toString(),
      details: `${wo.woNumber} assigned to ${tech.name} (${activeCount + 1}/${maxLimit} capacity)`,
    });

    res.json({
      success: true,
      sound: 'dispatch',
      wo,
      techName: tech.name,
      activeCount: activeCount + 1,
      maxLimit,
    });
  } catch (err) {
    console.error('Assign Error:', err.message);
    res.status(500).send('Server Error');
  }
});

// ═══════════════════════════════════════════════════════════════════
// STATUS UPDATE — Update WO status (frees capacity on completion)
// @route    PUT api/v1/work-orders/:id/status
// @desc     Update work order status
// @access   Private
// ═══════════════════════════════════════════════════════════════════
router.put('/:id/status', auth, async (req, res) => {
  try {
    const { status, subStatus } = req.body;
    const update = {};
    if (status) update.status = status;
    if (subStatus) update.subStatus = subStatus;

    const wo = await WorkOrder.findByIdAndUpdate(req.params.id, { $set: update }, { new: true });
    if (!wo) return res.status(404).json({ msg: 'Work order not found' });

    await AuditLog.create({
      action: 'WO_STATUS_UPDATED',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'workOrder',
      targetId: wo._id.toString(),
      details: `${wo.woNumber} status → ${status || wo.status} / ${subStatus || wo.subStatus}`,
    });

    res.json(wo);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ═══════════════════════════════════════════════════════════════════
// UPDATE — General WO update (all fields)
// @route    PUT api/v1/work-orders/:id
// @desc     Update a work order
// @access   Private
// ═══════════════════════════════════════════════════════════════════
router.put('/:id', auth, async (req, res) => {
  try {
    const wo = await WorkOrder.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true }
    );
    if (!wo) return res.status(404).json({ msg: 'Work order not found' });
    res.json(wo);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ═══════════════════════════════════════════════════════════════════
// TECH CAPACITY — Get/set tech WO limits
// @route    GET api/v1/work-orders/tech-capacity
// @desc     Get all techs with their active WO count and max limit
// @access   Private (COMPANY, ADMIN, OFFICE)
// ═══════════════════════════════════════════════════════════════════
router.get('/tech-capacity', auth, async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const techs = await User.find({ companyId, role: 'TECH', active: true })
      .select('name email techSkill rating maxActiveWOs');

    // Get active WO counts per tech
    const techIds = techs.map(t => t._id.toString());
    const activeWOs = await WorkOrder.aggregate([
      { $match: {
        assignedTechId: { $in: techIds },
        status: { $in: ['Active', 'Dispatched'] },
      }},
      { $group: { _id: '$assignedTechId', count: { $sum: 1 } } },
    ]);

    const countMap = {};
    activeWOs.forEach(a => { countMap[a._id] = a.count; });

    const result = techs.map(t => ({
      _id: t._id,
      name: t.name,
      email: t.email,
      techSkill: t.techSkill,
      rating: t.rating,
      maxActiveWOs: t.maxActiveWOs || 5,
      activeCount: countMap[t._id.toString()] || 0,
      atCapacity: (countMap[t._id.toString()] || 0) >= (t.maxActiveWOs || 5),
    }));

    res.json(result);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    PUT api/v1/work-orders/tech-capacity/:techId
// @desc     Update a tech's max WO limit
// @access   Private (COMPANY, ADMIN)
router.put('/tech-capacity/:techId', auth, async (req, res) => {
  try {
    if (!['COMPANY', 'OWNER', 'ADMIN', 'PLATFORM_OWNER'].includes(req.user.role)) {
      return res.status(403).json({ msg: 'Only admins can set tech capacity' });
    }

    const { maxActiveWOs } = req.body;
    if (!maxActiveWOs || maxActiveWOs < 1 || maxActiveWOs > 50) {
      return res.status(400).json({ msg: 'maxActiveWOs must be between 1 and 50' });
    }

    const tech = await User.findByIdAndUpdate(
      req.params.techId,
      { $set: { maxActiveWOs } },
      { new: true }
    ).select('name maxActiveWOs');

    if (!tech) return res.status(404).json({ msg: 'Tech not found' });

    await AuditLog.create({
      action: 'TECH_CAPACITY_UPDATED',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'user',
      targetId: req.params.techId,
      details: `${tech.name} max WO limit set to ${maxActiveWOs}`,
    });

    res.json({ msg: `${tech.name} capacity set to ${maxActiveWOs}`, tech });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    DELETE api/v1/work-orders/:id
// @desc     Delete a work order
// @access   Private
router.delete('/:id', auth, async (req, res) => {
  try {
    const wo = await WorkOrder.findByIdAndDelete(req.params.id);
    if (!wo) return res.status(404).json({ msg: 'Work order not found' });

    await AuditLog.create({
      action: 'WO_DELETED',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'workOrder',
      targetId: req.params.id,
      details: `Work order ${wo.woNumber} deleted`,
    });

    res.json({ msg: 'Work order deleted' });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ═══════════════════════════════════════════════════════════════════
// PHASE 3: AUTO-DISPATCH INTELLIGENCE — AI tech recommendation
// @route    GET api/v1/work-orders/suggest-tech/:id
// @desc     Get ranked tech suggestions for a WO based on skills,
//           capacity, efficiency, client familiarity, and equipment match
// @access   Private (COMPANY, ADMIN, OFFICE)
// ═══════════════════════════════════════════════════════════════════
router.get('/suggest-tech/:id', auth, async (req, res) => {
  try {
    const wo = await WorkOrder.findById(req.params.id);
    if (!wo) return res.status(404).json({ msg: 'Work order not found' });

    // Get all active techs in this company
    const techs = await User.find({
      companyId: req.user.companyId,
      role: 'TECH',
      active: true,
    }).select('name email techSkill rating maxActiveWOs');

    if (techs.length === 0) {
      return res.json({ suggestions: [], msg: 'No active technicians available' });
    }

    // Get all active WOs grouped by tech for capacity check
    const techIds = techs.map(t => t._id.toString());
    const activeWOs = await WorkOrder.aggregate([
      { $match: {
        assignedTechId: { $in: techIds },
        status: { $in: ['Active', 'Dispatched'] },
      }},
      { $group: { _id: '$assignedTechId', count: { $sum: 1 } } },
    ]);
    const capacityMap = {};
    activeWOs.forEach(a => { capacityMap[a._id] = a.count; });

    // Get recent WOs per tech for client familiarity + equipment match
    const recentWOs = await WorkOrder.find({
      assignedTechId: { $in: techIds },
      createdAt: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) },
    }).select('assignedTechId clientId model manufacturer').limit(500);

    // Build tech-client and tech-equipment maps
    const techClientMap = {}; // { techId: Set of clientIds }
    const techEquipMap = {};  // { techId: Set of models }
    recentWOs.forEach(r => {
      const tid = r.assignedTechId;
      if (!techClientMap[tid]) techClientMap[tid] = new Set();
      if (!techEquipMap[tid]) techEquipMap[tid] = new Set();
      if (r.clientId) techClientMap[tid].add(r.clientId);
      if (r.model) techEquipMap[tid].add(r.model.toLowerCase());
    });

    // Score each tech
    const woModel = (wo.model || '').toLowerCase();
    const woSkill = (wo.skill || wo.techSkill || '').toLowerCase();
    const woPriority = (wo.priority || '').toLowerCase();
    const woClientId = wo.clientId;

    const scored = techs.map(tech => {
      const tid = tech._id.toString();
      const active = capacityMap[tid] || 0;
      const maxWOs = tech.maxActiveWOs || 5;
      let score = 0;
      const reasons = [];

      // 1. Skill match (0-30 pts)
      const techSkillLower = (tech.techSkill || '').toLowerCase();
      if (woSkill && techSkillLower === woSkill) {
        score += 30;
        reasons.push(`✅ Skill match: ${tech.techSkill}`);
      } else if (techSkillLower === 'specialty') {
        score += 20; // Specialty techs can handle anything
        reasons.push('🔧 Specialty tech');
      } else {
        score += 10; // Basic skill
        reasons.push('🔧 General tech');
      }

      // 2. Capacity (0-25 pts — lower load = better)
      if (active >= maxWOs) {
        score -= 50; // Heavy penalty for at-capacity
        reasons.push(`🚫 AT CAPACITY (${active}/${maxWOs})`);
      } else {
        const capacityRatio = 1 - (active / maxWOs);
        const capPts = Math.round(capacityRatio * 25);
        score += capPts;
        reasons.push(`📊 Load: ${active}/${maxWOs} (${Math.round(capacityRatio * 100)}% available)`);
      }

      // 3. Rating/efficiency (0-20 pts)
      const rating = tech.rating || 3;
      score += Math.round((rating / 5) * 20);
      reasons.push(`⭐ Rating: ${rating}/5`);

      // 4. Client familiarity (0-15 pts)
      const knownClients = techClientMap[tid] || new Set();
      if (woClientId && knownClients.has(woClientId)) {
        score += 15;
        reasons.push('🏥 Has worked with this client');
      }

      // 5. Equipment experience (0-10 pts)
      const knownEquip = techEquipMap[tid] || new Set();
      if (woModel && knownEquip.has(woModel)) {
        score += 10;
        reasons.push(`🔩 Has serviced ${wo.model} before`);
      }

      // Emergency bonus — prefer available techs
      if (woPriority === 'emergency' && active === 0) {
        score += 10;
        reasons.push('🚨 Available for emergency');
      }

      return {
        techId: tid,
        name: tech.name,
        email: tech.email,
        skill: tech.techSkill,
        rating: tech.rating,
        activeWOs: active,
        maxWOs,
        score,
        reasons,
        recommended: score >= 40,
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    await AuditLog.create({
      action: 'DISPATCH_SUGGESTION',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'workOrder',
      targetId: req.params.id,
      details: `Auto-dispatch suggestions for ${wo.woNumber}: top pick = ${scored[0]?.name} (score ${scored[0]?.score})`,
    });

    res.json({
      woId: wo._id,
      woNumber: wo.woNumber,
      suggestions: scored,
      topPick: scored[0] || null,
    });
  } catch (err) {
    console.error('Suggest tech error:', err.message);
    res.status(500).send('Server Error');
  }
});

// ═══════════════════════════════════════════════════════════════════
// CREW MANAGEMENT — Multi-tech assignment for installs / team jobs
// ═══════════════════════════════════════════════════════════════════

// @route    PUT api/v1/work-orders/:id/crew
// @desc     Add a technician to the WO crew
// @access   Private (lead tech, COMPANY, ADMIN, OFFICE)
router.put('/:id/crew', auth, async (req, res) => {
  try {
    const { techId, techName } = req.body;
    if (!techId) return res.status(400).json({ msg: 'techId is required' });

    // 1. Load the WO
    const wo = await WorkOrder.findById(req.params.id);
    if (!wo) return res.status(404).json({ msg: 'Work order not found' });

    // 2. Permission: only lead tech, COMPANY, ADMIN, OFFICE, OWNER
    const isLeadTech = req.user.role === 'TECH' && wo.assignedTechId === req.user.id;
    const isManager = ['COMPANY', 'ADMIN', 'OFFICE', 'OWNER', 'PLATFORM_OWNER'].includes(req.user.role);
    if (!isLeadTech && !isManager) {
      return res.status(403).json({ msg: 'Only the lead tech or management can add crew members' });
    }

    // 3. Verify the tech exists and is same company
    const tech = await User.findById(techId);
    if (!tech || tech.role !== 'TECH') {
      return res.status(400).json({ msg: 'Invalid technician' });
    }
    if (tech.companyId !== req.user.companyId && req.user.role !== 'OWNER' && req.user.role !== 'PLATFORM_OWNER') {
      return res.status(403).json({ msg: 'Cannot add a tech from another company' });
    }

    // 4. Prevent duplicates — can't add lead tech or already-added tech
    if (wo.assignedTechId === techId) {
      return res.status(409).json({ msg: `${tech.name} is already the lead tech on this WO` });
    }
    const alreadyOnCrew = (wo.additionalTechs || []).some(t => t.techId === techId);
    if (alreadyOnCrew) {
      return res.status(409).json({ msg: `${tech.name} is already on the crew` });
    }

    // 5. Add to crew
    const crewEntry = {
      techId,
      techName: techName || tech.name,
      addedBy: req.user.id,
      addedAt: new Date()
    };

    const updated = await WorkOrder.findByIdAndUpdate(req.params.id, {
      $push: { additionalTechs: crewEntry }
    }, { new: true });

    await AuditLog.create({
      action: 'WO_CREW_ADDED',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'workOrder',
      targetId: wo._id.toString(),
      details: `${tech.name} added to crew on ${wo.woNumber} by ${req.user.id}`,
    });

    res.json({
      success: true,
      msg: `${tech.name} added to crew`,
      wo: updated,
    });
  } catch (err) {
    console.error('Add crew error:', err.message);
    res.status(500).send('Server Error');
  }
});

// @route    DELETE api/v1/work-orders/:id/crew/:techId
// @desc     Remove a technician from the WO crew
// @access   Private (lead tech, COMPANY, ADMIN, OFFICE)
router.delete('/:id/crew/:techId', auth, async (req, res) => {
  try {
    const wo = await WorkOrder.findById(req.params.id);
    if (!wo) return res.status(404).json({ msg: 'Work order not found' });

    // Permission: only lead tech, COMPANY, ADMIN, OFFICE, OWNER
    const isLeadTech = req.user.role === 'TECH' && wo.assignedTechId === req.user.id;
    const isManager = ['COMPANY', 'ADMIN', 'OFFICE', 'OWNER', 'PLATFORM_OWNER'].includes(req.user.role);
    if (!isLeadTech && !isManager) {
      return res.status(403).json({ msg: 'Only the lead tech or management can remove crew members' });
    }

    // Find the tech being removed (for audit log name)
    const removedTech = (wo.additionalTechs || []).find(t => t.techId === req.params.techId);
    if (!removedTech) {
      return res.status(404).json({ msg: 'Tech not found on crew' });
    }

    const updated = await WorkOrder.findByIdAndUpdate(req.params.id, {
      $pull: { additionalTechs: { techId: req.params.techId } }
    }, { new: true });

    await AuditLog.create({
      action: 'WO_CREW_REMOVED',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'workOrder',
      targetId: wo._id.toString(),
      details: `${removedTech.techName} removed from crew on ${wo.woNumber} by ${req.user.id}`,
    });

    res.json({
      success: true,
      msg: `${removedTech.techName} removed from crew`,
      wo: updated,
    });
  } catch (err) {
    console.error('Remove crew error:', err.message);
    res.status(500).send('Server Error');
  }
});

// ═══════════════════════════════════════════════════════════════════
// WO TEMPLATES — Save and create from reusable templates
// ═══════════════════════════════════════════════════════════════════

// @route    GET api/v1/work-orders/templates
// @desc     Get all WO templates for a company
router.get('/templates', auth, async (req, res) => {
  try {
    const templates = await WorkOrder.find({
      companyId: req.user.companyId,
      isTemplate: true,
    }).select('templateName templateCategory woType clientName model skill procedures priority recurrence').sort({ templateName: 1 });
    res.json(templates);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// @route    POST api/v1/work-orders/from-template/:templateId
// @desc     Create a new WO from a saved template
router.post('/from-template/:templateId', auth, async (req, res) => {
  try {
    const template = await WorkOrder.findById(req.params.templateId);
    if (!template || !template.isTemplate) {
      return res.status(404).json({ msg: 'Template not found' });
    }

    // Copy template fields but generate new WO number and reset status
    const woData = {
      woNumber: `WO-${Date.now().toString(36).toUpperCase()}`,
      type: template.type,
      formType: template.formType,
      companyId: req.user.companyId,
      clientId: req.body.clientId || template.clientId,
      clientName: req.body.clientName || template.clientName,
      model: template.model,
      serialNumber: req.body.serialNumber || template.serialNumber,
      skill: template.skill,
      woType: template.woType,
      priority: template.priority,
      site: req.body.site || template.site,
      building: req.body.building || template.building,
      location: req.body.location || template.location,
      customerIssue: template.customerIssue,
      procedures: template.procedures,
      createdBy: req.user.id,
      createdFromTemplate: req.params.templateId,
      status: 'Active',
      subStatus: 'Unscheduled',
    };

    // Auto-calculate SLA
    const priority = (woData.priority || 'normal').toLowerCase();
    woData.sla = calculateSLA(priority);

    const wo = await WorkOrder.create(woData);

    await AuditLog.create({
      action: 'WO_FROM_TEMPLATE',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'workOrder',
      targetId: wo._id.toString(),
      details: `${wo.woNumber} created from template "${template.templateName}"`,
    });

    res.status(201).json(wo);
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ═══════════════════════════════════════════════════════════════════
// SLA PAUSE / RESUME — Pause SLA when waiting for parts, etc.
// ═══════════════════════════════════════════════════════════════════
router.put('/:id/sla-pause', auth, async (req, res) => {
  try {
    const wo = await WorkOrder.findById(req.params.id);
    if (!wo) return res.status(404).json({ msg: 'Work order not found' });

    if (wo.sla?.pausedAt) {
      // Resume — calculate paused duration and add to total
      const pausedDuration = Date.now() - new Date(wo.sla.pausedAt).getTime();
      await WorkOrder.findByIdAndUpdate(req.params.id, {
        $set: { 'sla.pausedAt': null },
        $inc: { 'sla.totalPausedMs': pausedDuration },
      });
      res.json({ msg: 'SLA resumed', pausedDurationMs: pausedDuration });
    } else {
      // Pause
      await WorkOrder.findByIdAndUpdate(req.params.id, {
        $set: { 'sla.pausedAt': new Date() },
      });
      res.json({ msg: 'SLA paused', reason: req.body.reason || 'Waiting for parts' });
    }
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

// ═══════════════════════════════════════════════════════════════════
// BULK STATUS UPDATE — Batch operations on multiple WOs
// ═══════════════════════════════════════════════════════════════════
router.put('/bulk/status', auth, async (req, res) => {
  try {
    const { woIds, status, subStatus, assignedTechId, assignedTechName } = req.body;
    if (!woIds || !Array.isArray(woIds) || woIds.length === 0) {
      return res.status(400).json({ msg: 'woIds array is required' });
    }
    if (woIds.length > 50) {
      return res.status(400).json({ msg: 'Maximum 50 WOs per bulk operation' });
    }

    const update = {};
    if (status) update.status = status;
    if (subStatus) update.subStatus = subStatus;
    if (assignedTechId) {
      update.assignedTechId = assignedTechId;
      update.assignedTechName = assignedTechName;
    }

    const result = await WorkOrder.updateMany(
      { _id: { $in: woIds }, companyId: req.user.companyId },
      { $set: update }
    );

    await AuditLog.create({
      action: 'WO_BULK_UPDATE',
      userId: req.user.id,
      companyId: req.user.companyId,
      targetType: 'workOrder',
      targetId: woIds.join(','),
      details: `Bulk update ${result.modifiedCount} WOs: ${JSON.stringify(update)}`,
    });

    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server Error');
  }
});

module.exports = router;
