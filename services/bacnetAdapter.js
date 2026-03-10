/* ═══════════════════════════════════════════════════════════════════
   BACNET ADAPTER — Building Automation Sensor Integration
   Technical Made Easy — BACnet/IP Protocol Adapter

   Interfaces with BACnet-enabled building management systems for
   HVAC monitoring (temperature, humidity, pressure) in healthcare
   facilities. Supports device discovery and property reads.
   ═══════════════════════════════════════════════════════════════════ */

// ── BACnet Object Types ──
const OBJECT_TYPES = {
  ANALOG_INPUT:  0,
  ANALOG_OUTPUT: 1,
  ANALOG_VALUE:  2,
  BINARY_INPUT:  3,
  BINARY_OUTPUT: 4,
  BINARY_VALUE:  5,
  DEVICE:        8,
  MULTI_STATE_INPUT: 13,
  MULTI_STATE_OUTPUT: 14,
};

// ── BACnet Property IDs ──
const PROPERTY_IDS = {
  PRESENT_VALUE:    85,
  OBJECT_NAME:      77,
  DESCRIPTION:      28,
  UNITS:           117,
  STATUS_FLAGS:    111,
  OUT_OF_SERVICE:   81,
  EVENT_STATE:      36,
  RELIABILITY:     103,
  MIN_VALUE:        69,
  MAX_VALUE:        65,
};

// ── Engineering Unit Mapping (ASHRAE) ──
const UNITS_MAP = {
  62: { label: '°F', type: 'temperature' },
  64: { label: '°C', type: 'temperature' },
  65: { label: 'K',  type: 'temperature' },
  19: { label: '%RH', type: 'humidity' },
  53: { label: 'psi', type: 'pressure' },
  54: { label: 'inHg', type: 'pressure' },
  55: { label: 'Pa', type: 'pressure' },
  56: { label: 'kPa', type: 'pressure' },
  85: { label: 'CFM', type: 'flowRate' },
  142: { label: 'GPM', type: 'flowRate' },
  95: { label: 'W',  type: 'power' },
  43: { label: 'RPM', type: 'vibration' },
};

// ── Simulated BACnet Device Registry ──
// In production, this would be populated by BACnet Who-Is discovery
const deviceRegistry = new Map();

/**
 * Discover BACnet devices on the network
 * @param {string} subnet — e.g. '192.168.1.0/24'
 * @param {number} timeout — ms to wait for I-Am responses
 * @returns {{ devices: Array }} discovered devices
 */
function discoverDevices(subnet = '192.168.1.0/24', timeout = 5000) {
  // NOTE: In production, this would use bacstack npm package to send
  // BACnet Who-Is broadcast and collect I-Am responses.
  // For now, return the registry or demo devices.
  const devices = Array.from(deviceRegistry.values());

  if (devices.length === 0) {
    // Return demo devices for UI testing
    return {
      devices: [
        {
          deviceId: 1001, ip: '192.168.1.101', name: 'AHU-1 Controller',
          vendor: 'Johnson Controls', model: 'FX-PCG',
          objects: [
            { type: OBJECT_TYPES.ANALOG_INPUT, instance: 1, name: 'Supply Air Temp', units: 64 },
            { type: OBJECT_TYPES.ANALOG_INPUT, instance: 2, name: 'Return Air Temp', units: 64 },
            { type: OBJECT_TYPES.ANALOG_INPUT, instance: 3, name: 'Supply Air Humidity', units: 19 },
          ],
        },
        {
          deviceId: 1002, ip: '192.168.1.102', name: 'Chiller Plant Monitor',
          vendor: 'Trane', model: 'Tracer SC',
          objects: [
            { type: OBJECT_TYPES.ANALOG_INPUT, instance: 1, name: 'Chilled Water Supply Temp', units: 64 },
            { type: OBJECT_TYPES.ANALOG_INPUT, instance: 2, name: 'Condenser Pressure', units: 53 },
            { type: OBJECT_TYPES.ANALOG_INPUT, instance: 3, name: 'Compressor Vibration', units: 43 },
          ],
        },
        {
          deviceId: 1003, ip: '192.168.1.103', name: 'Cleanroom Monitor',
          vendor: 'Siemens', model: 'PXC Compact',
          objects: [
            { type: OBJECT_TYPES.ANALOG_INPUT, instance: 1, name: 'Room Temperature', units: 64 },
            { type: OBJECT_TYPES.ANALOG_INPUT, instance: 2, name: 'Room Humidity', units: 19 },
            { type: OBJECT_TYPES.ANALOG_INPUT, instance: 3, name: 'Differential Pressure', units: 55 },
          ],
        },
      ],
      source: 'demo',
      scannedSubnet: subnet,
    };
  }

  return { devices, source: 'live', scannedSubnet: subnet };
}

/**
 * Register a BACnet device manually
 */
function registerDevice(device) {
  deviceRegistry.set(device.deviceId, {
    ...device,
    registeredAt: new Date().toISOString(),
  });
  return { registered: true, deviceId: device.deviceId };
}

/**
 * Read a BACnet object property (simulated)
 * @param {number} deviceId
 * @param {number} objectType
 * @param {number} instance
 * @param {number} propertyId
 */
function readProperty(deviceId, objectType, instance, propertyId = PROPERTY_IDS.PRESENT_VALUE) {
  // In production: use bacstack to send ReadProperty request
  // For now, return simulated values based on object type
  const unitInfo = UNITS_MAP[62] || { label: '', type: 'custom' };
  const device = deviceRegistry.get(deviceId);
  const obj = device?.objects?.find(o => o.type === objectType && o.instance === instance);

  return {
    deviceId,
    objectType,
    instance,
    propertyId,
    value: simulateValue(unitInfo.type),
    unit: obj?.units ? UNITS_MAP[obj.units]?.label || '' : '',
    sensorType: obj?.units ? UNITS_MAP[obj.units]?.type || 'custom' : 'custom',
    objectName: obj?.name || `Object ${objectType}:${instance}`,
    timestamp: new Date().toISOString(),
    source: 'bacnet',
  };
}

/**
 * Generate realistic simulated sensor values for demo
 */
function simulateValue(type) {
  const noise = (Math.random() - 0.5) * 2;
  switch (type) {
    case 'temperature': return +(22 + noise * 3).toFixed(1);   // 19-25°C
    case 'humidity':    return +(45 + noise * 10).toFixed(1);   // 35-55%RH
    case 'pressure':    return +(14.7 + noise * 0.5).toFixed(2); // ~14.5-14.9 psi
    case 'flowRate':    return +(500 + noise * 100).toFixed(0);  // 400-600 CFM
    case 'vibration':   return +(1800 + noise * 200).toFixed(0); // 1600-2000 RPM
    case 'power':       return +(2400 + noise * 300).toFixed(0); // 2100-2700 W
    default:            return +(50 + noise * 25).toFixed(1);
  }
}

/**
 * Map a BACnet reading to TME sensor format
 */
function mapToSensorReading(reading) {
  return {
    sensorType: reading.sensorType,
    value: reading.value,
    unit: reading.unit,
    timestamp: reading.timestamp,
    source: 'bacnet',
    sourceDevice: reading.objectName,
    deviceId: reading.deviceId,
    protocol: 'BACnet/IP',
  };
}

// ── Exports ──
module.exports = {
  OBJECT_TYPES,
  PROPERTY_IDS,
  UNITS_MAP,
  discoverDevices,
  registerDevice,
  readProperty,
  mapToSensorReading,
  simulateValue,
};
