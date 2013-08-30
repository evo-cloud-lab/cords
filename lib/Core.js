var Class = require('js-class'),

    Neuron = require('evo-neuron').Neuron;

var Core = Class(process.EventEmitter, {
    constructor: function () {
        (this.neuron = new Neuron({ name: 'cords', connects: ['connector'] }))
            .subscribe('state', 'connector', this.onState.bind(this))
            .subscribe('update', 'connector', this.onUpdate.bind(this))
            .subscribe('message', 'connector', this.onMessage.bind(this))
            .on('state', this.onBranchState.bind(this));
    },

    get nodeId () {
        return this._localId;
    },

    get state () {
        return this._state;
    },

    get nodes () {
        return this._nodes;
    },

    get masterId () {
        return this._masterId;
    },

    start: function () {
        this.neuron.start();
    },

    send: function (msg, dest) {
        if (dest == 'master') {
            dest = this.masterId;
        } else if (dest == '*') {   // for broadcast
            dest = undefined;
        }
        return this.neuron.send('connector', { event: 'send', data: { msg: msg, dst: dest } });
    },

    sendToMaster: function (msg) {
        return this.send(msg, 'master');
    },

    onState: function (msg) {
        this._updateState(msg.data.state);
    },

    onUpdate: function (msg) {
        if (this._revision != msg.data.revision) {
            this._sync();
        } else {
            this._updateState(msg.data.state);
        }
    },

    onMessage: function (msg) {
        var src = msg.id;
        var origin = msg.data.msg;
        this.emit('msg:' + origin.event, origin, src);
    },

    onBranchState: function (state, name) {
        if (name == 'connector' && state == 'connected') {
            this._sync();
        }
    },

    _updateState: function (newState) {
        if (this._state != newState) {
            this._state = newState;
            this.emit('state', this._state);
        }
    },

    _sync: function () {
        this.neuron.request('connector', { event: 'sync' }, function (err, msg) {
            if (!err && msg && msg.data) {
                this._revision = msg.data.revision;
                this._nodes    = msg.data.nodes;
                this._masterId = msg.data.master;
                this._localId  = msg.data.localId;
                this._updateState(msg.data.state);
                this.emit('nodes');
            }
        }.bind(this));
    }
});

module.exports = Core;