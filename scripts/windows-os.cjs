// Some restricted Windows sessions cannot resolve the local account via libuv.
const os = require('node:os');
const original = os.userInfo;
os.userInfo = (...args) => { try { return original(...args); } catch { return { uid: -1, gid: -1, username: process.env.USERNAME || 'user', homedir: os.homedir(), shell: null }; } };
