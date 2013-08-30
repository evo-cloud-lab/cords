var Class = require('js-class');

function countTransform (policy, nodes) {
    var matcher = this.roleMatcher(policy);
    var count = Object.keys(nodes).reduce(function (count, id) {
        if (matcher.match(nodes[id])) {
            count ++;
        }
        return count;
    }, 0);
    return { count: count, value: count };
}

function percentageTransform (policy, nodes) {
    var result = countTransform.call(this, policy, nodes);
    result.value = result.count * 100 / Object.keys(nodes).length;
    return result;
}

var PolicyEngine = Class({
    constructor: function (policies) {
        this.policies = policies;
    },

    evaluate: function (nodes, callback) {
        this.policies.forEach(function (policy) {
            var transformer = PolicyEngine.transformers[policy.transform];
            if (!transformer) {
                return;
            }

            var sample = transformer.call(this, policy, nodes);
            if (!sample) {
                return;
            }

            var direction;
            if (policy.min != null && sample.value < policy.min) {
                direction = -1;
            } else if (policy.max != null && sample.value > policy.max) {
                direction = 1;
            }
            if (!direction) {
                return;
            }

            var deviation = { direction: direction, policy: policy, sample: sample, origin: nodes };
            var amender = PolicyEngine.amenders[policy.amend];
            amender && (deviation = amender.call(this, deviation));

            deviation && callback && callback(deviation);
        }, this);
        return this;
    },

    roleMatcher: function (policy) {
        var tokens = policy.target.split('=');
        return Object.create({
            name: tokens[0],
            state: tokens[1],
            match: function (nodeState) {
                var role = nodeState.roles[this.name];
                return role && (this.state == null || this.state == role.state) ? role : undefined;
            }
        });
    }
}, {
    statics: {
        transformers: {
            count: countTransform,
            percentage: percentageTransform
        },

        amenders: {
            promotion: require('./PromotionAmender')
        }
    }
});

module.exports = PolicyEngine;