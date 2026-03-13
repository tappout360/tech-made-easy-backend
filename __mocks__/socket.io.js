// Manual mock for socket.io — used by Jest when socketService.js requires it
const Server = jest.fn().mockImplementation(() => ({
  on: jest.fn(),
  to: jest.fn().mockReturnThis(),
  emit: jest.fn(),
  use: jest.fn(),
  of: jest.fn().mockReturnThis(),
}));

module.exports = { Server };
