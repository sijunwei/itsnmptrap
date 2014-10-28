var snmp = require('snmp-native');

var snmprouter = function(opts) {
  opts = opts || {};

  opts.once = opts.once || false;
  this.opts = opts;
  this._traps = [];
  this._filters = [];
};

snmprouter.prototype.use = function(oid, cb) {
  if(typeof oid === 'function') {
    cb = oid;
    oid = /./;
  }

  this._addtostore('_filters', oid, {}, cb);
  return this;
};

snmprouter.prototype.trap = function(_oid, _opts, _callback) {
  var oid, opts, callback;

  switch(arguments.length) {
    case 1:
      if(typeof _oid !== 'function')
        throw "[Error: must provide a callback for a trap route]";

      oid = /./;
      opts = {};
      callback = oid;
      break;
    case 2:
      if(typeof _oid === 'string' || (_oid instanceof RegExp)) {
        oid = _oid;
        opts = {};
      } else {
        oid = /./;
        opts = _oid;
      }
      callback = _opts;
      break;
    default:
      oid = _oid;
      opts = _opts;
      callback = _callback;
  }

  this._addtostore('_traps', oid, opts, callback);
  return this;
};

snmprouter.prototype._addtostore = function(store, oid, opts, callback) {
  store = store || '_traps';
  
  opts.once = opts.once || this.opts.once || false;
  var raddr = /./;
  if(/@/.test(oid)) {
    var splitoid = oid.split('@');
    raddr = splitoid[0]; //.replace(/\./g, "\\.");
    oid = splitoid[1];

    if(require('net').isIP(raddr)) raddr = new RegExp("^" + raddr.replace(/\./g, "\\.") + "$");
    else raddr = new RegExp(raddr);
  }
  this[store].push({raddr: raddr, oid: oid, callback: callback, opts: opts});
};

snmprouter.prototype.findcb = function(remote, oid, store) {
  store = store || "_traps";
  var self = this;
  var cbs = this[store].filter(function(v) {
    if(v.oid instanceof RegExp && v.oid.test(oid) && v.raddr.test(remote)) {
      return true;
    } else if(typeof v.oid === 'string' && v.oid === oid && v.raddr.test(remote)) {
      return true;
    }
    return false;
  }).sort(function(a, b) {
    var rtn = 0;
    if(a.opts.once && !b.opts.once) return -1;
    var ord = (a.oid.length || a.oid.toString().length) - (b.oid.length || b.oid.toString().length);
    rtn = -ord;
    return rtn;
  });
  return cbs;
};

snmprouter.prototype._filter = function(trap, endcb) {
  var filters = this.findcb(trap.remote, trap.oid, '_filters');
  
  if(filters.length > 0)
    snmprouter._filterwalk(trap, filters, 0, endcb);
  else
    endcb(trap);
};

snmprouter._filterwalk = function(trap, list, i, end) {
  if(typeof list[i] === 'undefined') {
    end(trap) //, list, i-1);
    return;
  }

  list[i].callback.call(null, trap, function(ok) {
    if((typeof ok === 'boolean' && ok !== false) || typeof ok === 'undefined')
      setImmediate(snmprouter._filterwalk.bind(null, trap, list, i+1, end));
  });
};

snmprouter.prototype.runmsg = function(rawmsg, remote) {
  var self = this;
  var msg = snmp.parse(rawmsg);
  var ran = {};
  msg.pdu.varbinds.forEach(function(vb) {
    var oid = vb.oid.join('.');
    if(ran[oid]) return;

    var trap = {
      oid:oid
      , value: vb.value
      , varbind: vb
      , msg: msg
      , remote: remote
    };
    self._filter(trap, function() {
      self.findcb(remote.address, oid).forEach(function(v) {
        if(ran[oid] && v.opts.once) return;

        ran[oid] = true;

        v.callback({oid:oid, value: vb.value, varbind: vb, msg: msg, remote: remote})
      });
    });
  });
};

snmprouter.prototype.listen = function(port, address, callback) {
  var self = this;
  address = address || "0.0.0.0";
  var addresstype = 'udp' + require('net').isIP(address);
  self._dgram = require('dgram').createSocket(addresstype, function(msg, remote) {
    self.runmsg(msg, remote);
  });
  self._dgram.bind(port, address);
};

snmprouter.prototype.close = function() {
  this._dgram.close();
};

module.exports = snmprouter;