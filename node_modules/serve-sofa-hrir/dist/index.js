'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.ServerDataBase = exports.HrtfSet = undefined;

var _HrtfSet = require('./sofa/HrtfSet');

var _HrtfSet2 = _interopRequireDefault(_HrtfSet);

var _ServerDataBase = require('./sofa/ServerDataBase');

var _ServerDataBase2 = _interopRequireDefault(_ServerDataBase);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

exports.HrtfSet = _HrtfSet2.default;
exports.ServerDataBase = _ServerDataBase2.default;
exports.default = {
  HrtfSet: _HrtfSet2.default,
  ServerDataBase: _ServerDataBase2.default
};

// import audio from './audio';
// export { audio };
// import common from './common';
// export { common };
// import geometry from './geometry';
// export { geometry };
// import info from './info';
// export { info };
// import sofa from './sofa';
// export { sofa };

// export default {
//   audio,
//   common,
//   geometry,
//   info,
//   sofa,
// };