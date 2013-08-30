var Class = require('js-class'),
    BiMap = require('evo-elements').BiMap;

var Schemas = {
    ROUTE: {
        scope: 'string',
        topic: 'string',
        msg: 'object'
    }
};

var Router = Class({
    constructor: function (core) {
        this._subs = new BiMap('topic', 'id');
        this.core = core;
        (this.neuron = core.neuron)
            .dispatch('route', this.handleRoute.bind(this))
            .dispatch('sub', this.handleSub.bind(this))
            .subscribe('message', 'connector', this.onConnectorMsg.bind(this))
            .on('disconnect', this.onDisconnect.bind(this));
    },

    handleRoute: function (req) {
        // TODO
    },

    handleSub: function (req) {
        var topics = req.data.topics || [];
        Array.isArray(topics) || (topics = [topics]);
        this._subs.removeAll(req.src, 'id');
        topics.forEach(function (topic) {
            this._subs.add(topic, req.src, true);
        });
    },

    onDisconnect: function (id) {
        this._subs.removeAll(id, 'id');
    },

    onConnectorMsg: function (msg) {
        msg = msg.data.msg;
        if (msg && msg.event == 'route') {
            this.neuron.cast(msg.data.msg, { target: this._subs.keys(msg.data.topic, 'topic') });
        }
    }
});

module.exports = Router;