/* ═══════════════════════════════════════════════════════════════════
   HL7 ADAPTER — Medical Device Data Integration
   Technical Made Easy — HL7 v2 + FHIR Message Parser

   Parses HL7 messages from medical devices and maps them to TME
   sensor readings. Supports ADT, ORU, and ORM message types.
   HIPAA: All HL7 data contains PHI — encrypted in transit + at rest.
   ═══════════════════════════════════════════════════════════════════ */

// ── HL7 v2 Message Types ──
const MESSAGE_TYPES = {
  ADT: { name: 'Admit/Discharge/Transfer', description: 'Patient movement events' },
  ORU: { name: 'Observation Result', description: 'Lab/device observation results' },
  ORM: { name: 'Order Message', description: 'Equipment service order' },
  SIU: { name: 'Schedule Info', description: 'Equipment scheduling updates' },
};

// ── HL7 v2 Segment Parsers ──
function parseSegment(raw) {
  const fields = raw.split('|');
  const segmentId = fields[0];
  return { segmentId, fields };
}

function parseMSH(fields) {
  return {
    sendingApp: fields[2] || '',
    sendingFacility: fields[3] || '',
    receivingApp: fields[4] || '',
    receivingFacility: fields[5] || '',
    timestamp: fields[6] || '',
    messageType: fields[8] || '',
    controlId: fields[9] || '',
    version: fields[11] || '2.5',
  };
}

function parseOBX(fields) {
  return {
    setId: fields[1] || '',
    valueType: fields[2] || '',
    observationId: fields[3] || '',
    observationSubId: fields[4] || '',
    value: fields[5] || '',
    units: fields[6] || '',
    referenceRange: fields[7] || '',
    abnormalFlags: fields[8] || '',
    status: fields[11] || '',
    timestamp: fields[14] || '',
  };
}

// ── Parse full HL7 v2 message ──
function parseHL7Message(rawMessage) {
  const segments = rawMessage.split('\r').filter(Boolean);
  const parsed = { segments: [], header: null, observations: [] };

  for (const seg of segments) {
    const { segmentId, fields } = parseSegment(seg);
    switch (segmentId) {
      case 'MSH':
        parsed.header = parseMSH(fields);
        break;
      case 'OBX':
        parsed.observations.push(parseOBX(fields));
        break;
      default:
        parsed.segments.push({ segmentId, fields });
    }
  }
  return parsed;
}

// ── Map HL7 observations to TME sensor readings ──
function mapToSensorReading(observation, header) {
  const obsCode = observation.observationId.split('^')[0] || '';
  const sensorTypeMap = {
    '8310-5': 'temperature',     // LOINC: Body temperature
    '8462-4': 'pressure',        // LOINC: Diastolic BP
    '8480-6': 'pressure',        // LOINC: Systolic BP
    '2708-6': 'spo2',           // LOINC: SpO2
    '8867-4': 'heartRate',      // LOINC: Heart rate
    '20564-1': 'spo2',         // LOINC: Oxygen saturation
    'TEMP':    'temperature',
    'HUMID':   'humidity',
    'PRESS':   'pressure',
    'VIBR':    'vibration',
    'FLOW':    'flowRate',
  };

  return {
    sensorType: sensorTypeMap[obsCode] || 'custom',
    value: parseFloat(observation.value) || 0,
    unit: observation.units.split('^')[0] || '',
    timestamp: observation.timestamp || header?.timestamp || new Date().toISOString(),
    source: 'hl7',
    sourceDevice: header?.sendingApp || 'Unknown',
    facility: header?.sendingFacility || '',
    abnormal: observation.abnormalFlags !== '',
    raw: observation,
  };
}

// ── FHIR R4 Observation Parser ──
function parseFHIRObservation(resource) {
  if (resource.resourceType !== 'Observation') return null;
  const coding = resource.code?.coding?.[0] || {};
  return {
    sensorType: coding.display?.toLowerCase() || 'custom',
    value: resource.valueQuantity?.value || 0,
    unit: resource.valueQuantity?.unit || '',
    timestamp: resource.effectiveDateTime || new Date().toISOString(),
    source: 'fhir',
    sourceDevice: resource.device?.display || 'Unknown',
    status: resource.status,
    loincCode: coding.code || '',
  };
}

// ── Exports ──
module.exports = {
  MESSAGE_TYPES,
  parseHL7Message,
  mapToSensorReading,
  parseFHIRObservation,
  parseSegment,
  parseMSH,
  parseOBX,
};
