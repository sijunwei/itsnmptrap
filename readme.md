ItSNMPTrap
==========

It's a trap...receiver router similar in concept to how Expressjs routes HTTP requests. Has been tested and works with SNMPv2c.

Makes use of the snmp-native package for parsing SNMP messages.

## Examples

```
var snmprouter = require('itsnmptrap');
var trapper = new snmprouter({once: true});

trapper.use(function(trap, next) {
  //only allow traps from 
  next(/192\.168\.1\./.test(trap.remote.address));
});

trapper.trap('1.3.6.1.4.1.20632.2.3', function(trap) {
  console.log("Barracuda out queue:", trap.value);
})
```

##Methods

####constructor([opts])

```
opts: {
  once: false // If true, only executes the first matching trap() callback.
              // Sets the default for all trap()s.
}
```

#### use([oid], callback)
Somewhat similar to Expressjs and it's use(). This can filter the incoming SNMP messages before getting the trap()s.

* oid can be either a string or a RegExp. If not provided uses the RegExp `/./`.

If oid is a string, it must match against entire oid from the snmp message.
OIDs for specific hosts can be defined by using the ipaddress@oid format.
When using the ipaddress@oid format, the ip address portion can be a regex that does not make use of the @ sign.

Alternatively, RegExp can be used for matching oids.

```
callback(trap, next)
  //next takes a boolean or no value.
  //True or undefined proceeds to the next filter
  //False or not calling next() stops processing the chain and will 
  //  prevent further processing of the SNMP message.

trap = {
  oid: 'oid'
  ,value: 'value'
  ,varbind: 'raw varbind provided by snmp-native'
  ,msg: 'entire snmp-native object of original message'
  ,remote: {address: 'remote ip address', port: 'remote port'}
  
}
```

#####example
```
//don't process any oids starting with 1.3
use(/1\.3/, function(trap, next) { next(false); });
//don't process any oid's with the remote ip address 1.1.1.1.
use(function(trap, next) { next(trap.remote.address == '1.1.1.1'); });
```



#### trap([oid], [opt], callback)

* oid is the same as use().
* opt is the same as the constructor and overrides the value given when the object instance is created.

```
trap(oid, callback)
trap(opt, callback)
trap(oid, opt, callback)

callback(trap) //trap is the same as the one from use().
```


#### listen(port, [address])
Start listening on a port for SNMP traps

#### close()
Stops the UDP socket.


License
=======
MIT
