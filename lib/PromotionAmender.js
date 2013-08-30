var _ = require('underscore');

function selectNodes (matcher, nodes) {
    return Object.keys(nodes).filter(function (id) {
        return !!matcher.match(nodes[id]);
    });
}

function upgrade (deviation) {
    var matcher = this.roleMatcher(deviation.policy);
    // save current state as matcher will be used to match "upgradeFrom" states
    var expectedState = matcher.state;

    // get upgradeFrom states from policy. Nodes are matched in the order of states
    // defined in upgradeFrom.
    var candidates = deviation.policy.candidates;
    candidates && !Array.isArray(candidates) && (candidates = [candidates]);
    var selectedIds = [], request = deviation.policy.min - deviation.sample.count;
    for (var i in candidates) {
        matcher.state = candidates[i];
        // select randomly: TODO use a more accurate way
        var nodeIds = _.shuffle(selectNodes(matcher, deviation.origin)).slice(0, request);
        selectedIds = selectedIds.concat(nodeIds);
        request -= nodeIds.length;
        if (request <= 0) {
            break;
        }
    }

    // if we found some nodes to be upgaded
    if (selectedIds.length > 0) {
        deviation.action  = 'enforce';
        deviation.rules   = [{ name: matcher.name, state: expectedState }];
        deviation.targets = selectedIds;
    }
    return deviation;
}

function degrade (deviation) {
    var matcher = this.roleMatcher(deviation.policy);
    var targetState = deviation.policy.degrade;
    if (targetState) {
        var request = deviation.sample.count - deviation.policy.max;
        var nodeIds = _.shuffle(selectNodes(this.roleMatcher(deviation.policy), deviation.origin)).slice(0, request);
        if (nodeIds.length > 0) {
            deviation.action = 'enforce';
            deviation.rules = [{ name: matcher.name, state: targetState }];
            deviation.targets = nodeIds;
        }
    }
    return deviation;
}

module.exports = function (deviation) {
    if (deviation.direction < 0) {
        return upgrade.call(this, deviation);
    } else if (deviation.direction > 0) {
        return degrade.call(this, deviation);
    }
    return deviation;
};