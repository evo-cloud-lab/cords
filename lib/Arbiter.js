var Class    = require('js-class'),
    elements = require('evo-elements'),
    Schema       = elements.Schema,
    StateMachine = elements.StateMachine,

    PolicyEngine = require('./PolicyEngine');

var Arbiter = Class({
    constructor: function (core, opts) {
        this._roleIds = {};
        this._localState = { roles: {}, resources: {} };
        (this.core = core)
            .on('state', this.onState.bind(this))
            .on('msg:nodeState', this.onNodeState.bind(this))
            .on('msg:enforceRole', this.onEnforceRole.bind(this));
        (this.neuron = core.neuron)
            .dispatch('role', this.handleRole.bind(this))
            .dispatch('resources', this.handleResources.bind(this))
            .on('disconnect', this.onDisconnect.bind(this));
        (this._states = new StateMachine())
            .state('offline', new OfflineState(this))
                .when('announcing').to('master')
                .when('master').to('master')
                .when('member').to('member')
                .fallback('offline')
            .state('master', new MasterState(this, opts))
                .when('connecting').to('offline')
                .when('member').to('member')
                .fallback('master')
            .state('member', new MemberState(this))
                .when('member').to('member')
                .when('announcing').to('master')
                .when('master').to('master')
                .fallback('offline')
            .start();
    },

    get localState () {
        return this._localState;
    },

    handleRole: function (req) {
        var role = req.data;
        if (role.name) {
            this._localState.roles[role.name] = role;
            var names = this._roleIds[req.src];
            names || (names = this._roleIds[req.src] = {});
            names[role.name] = true;
            this._localStateChanged();
        }
    },

    handleResources: function (req) {
        // TODO
    },

    onNodeState: function (msg, id) {
        this._states.process('nodeState', msg.data, id);
    },

    onEnforceRole: function (msg) {
        var rules = msg.data.rules;
        Array.isArray(rules) && rules.forEach(this._enforceRole.bind(this));
    },

    onState: function (state) {
        this._states.transit(state);
    },

    onDisconnect: function (id) {
        var names = this._roleIds[id];
        names && Object.keys(names).reduce(function (result, name) {
            result || (result = !!this._localState.roles[name]);
            delete this._localState.roles[name]
            return result;
        }.bind(this), false) && this._localStateChanged();
    },

    _localStateChanged: function () {
        this._states.process('localStateChanged');
    },

    _roleId: function (name) {
        for (var id in this._roleIds) {
            if (this._roleIds[id][rule.name]) {
                return id;
            }
        }
        return undefined;
    },

    _enforceRole: function (rule) {
        var roleId = this._roleId(rule.name);
        if (roleId) {
            this.neuron.cast({ event: 'enforce', data: rule }, { target: roleId });
        }
    }
});

var StateBase = Class({
    constructor: function (host) {
        this.host = host;
    },

    process: function (transit, action) {
        var fn = this['process:' + action];
        fn && fn.apply(this, [].slice.call(arguments, 1));
    }
});

var OfflineState = Class(StateBase, {
    constructor: function () {
        StateBase.prototype.constructor.apply(this, arguments);
    }
});

var MasterState = Class(StateBase, {
    constructor: function (host, opts) {
        StateBase.prototype.constructor.call(this, host);
        this._engine = new PolicyEngine(typeof(opts.policies) == 'object' ? opts.policies : {});
    },

    get nodeId () {
        return this.host.core.nodeId;
    },

    get localState () {
        return this.host.localState;
    },

    enter: function () {
        this._nodes = {};
        this._nodes[this.host.core.nodeId] = this.host.localState;
    },

    'process:localStateChanged': function () {
        this._nodes[this.nodeId] = this.localState;
        this._evaluate();
    },

    'process:nodeState': function (state, id) {
        if (id != this.nodeId) {
            this._nodes[id] = state;
            this._evaluate();
        }
    },

    _evaluate: function () {
        this._engine.evaluate(this._nodes, function (deviation) {
            if (deviation.action == 'enforce' && deviation.rules) {
                this.host.core.send({ event: 'enforceRole', data: { rules: rules } }, deviation.targets);
            }
        }.bind(this));
    }
});

var MemberState = Class(StateBase, {
    constructor: function () {
        StateBase.prototype.constructor.apply(this, arguments);
    },

    enter: function () {
        this._report();
    },

    'process:localStateChanged': function () {
        this._report();
    },

    _report: function () {
        this.host.core.sendToMaster({ event: 'nodeState', data: this.host.localState });
    }
});

module.exports = Arbiter;