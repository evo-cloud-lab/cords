var assert = require('assert'),

    PolicyEngine = require('../lib/PolicyEngine');

describe('PolicyEngine', function () {
    it('#roleMatcher', function () {
        var engine = new PolicyEngine([{ target: 'service=online' }]);
        var matcher = engine.roleMatcher(engine.policies[0]);
        assert.ok(matcher.match({ roles: { service: { state: 'online' } } }));
        assert.ok(!matcher.match({ roles: { service: { state: 'standby' } } }));
        assert.ok(!matcher.match({ roles: { other: { state: 'online' } } }));
    });

    it('transformer - count', function () {
        new PolicyEngine([
            {
                target: 'service=online',
                transform: 'count',
                min: 3,
                max: 5
            }
        ]).evaluate({
            n01: { roles: { service: { name: 'service', state: 'online' } } },
            n02: { roles: { service: { name: 'service', state: 'online' } } },
            n03: { roles: { service: { name: 'service', state: 'standby' } } },
            n04: { roles: { other: { name: 'other', state: 'online' } } }
        }, function (deviation) {
            assert.ok(deviation.direction < 0);
            assert.equal(deviation.sample.value, 2);
            assert.equal(deviation.sample.count, 2);
        }).evaluate({
            n01: { roles: { service: { name: 'service', state: 'online' } } },
            n02: { roles: { service: { name: 'service', state: 'online' } } },
            n03: { roles: { service: { name: 'service', state: 'online' } } },
            n04: { roles: { service: { name: 'service', state: 'online' } } },
            n05: { roles: { service: { name: 'service', state: 'online' } } },
            n06: { roles: { service: { name: 'service', state: 'online' } } }
        }, function (deviation) {
            assert.ok(deviation.direction > 0);
            assert.equal(deviation.sample.value, 6);
            assert.equal(deviation.sample.count, 6);
        }).evaluate({
            n01: { roles: { service: { name: 'service', state: 'online' } } },
            n02: { roles: { service: { name: 'service', state: 'online' } } },
            n03: { roles: { service: { name: 'service', state: 'online' } } },
            n04: { roles: { service: { name: 'service', state: 'standby' } } },
            n05: { roles: { other: { name: 'other', state: 'online' } } }
        }, function (deviation) {
            assert.ok(false, 'should not happen');
        });
    });

    it('transformer - percentage', function () {
        new PolicyEngine([
            {
                target: 'service=online',
                transform: 'percentage',
                min: 50,
                max: 80
            }
        ]).evaluate({
            n01: { roles: { service: { name: 'service', state: 'online' } } },
            n02: { roles: { service: { name: 'service', state: 'online' } } },
            n03: { roles: { service: { name: 'service', state: 'standby' } } },
            n04: { roles: { other: { name: 'other', state: 'online' } } },
            n05: { roles: { other: { name: 'other', state: 'online' } } }
        }, function (deviation) {
            assert.ok(deviation.direction < 0);
            assert.equal(deviation.sample.value, 40);
            assert.equal(deviation.sample.count, 2);
        }).evaluate({
            n01: { roles: { service: { name: 'service', state: 'online' } } },
            n02: { roles: { service: { name: 'service', state: 'online' } } },
            n03: { roles: { service: { name: 'service', state: 'online' } } },
            n04: { roles: { service: { name: 'service', state: 'online' } } },
            n05: { roles: { service: { name: 'service', state: 'online' } } },
            n06: { roles: { service: { name: 'service', state: 'online' } } }
        }, function (deviation) {
            assert.ok(deviation.direction > 0);
            assert.equal(deviation.sample.value, 100);
            assert.equal(deviation.sample.count, 6);
        }).evaluate({
            n01: { roles: { service: { name: 'service', state: 'online' } } },
            n02: { roles: { service: { name: 'service', state: 'online' } } },
            n03: { roles: { service: { name: 'service', state: 'online' } } },
            n04: { roles: { service: { name: 'service', state: 'standby' } } },
            n05: { roles: { other: { name: 'other', state: 'online' } } },
            n06: { roles: { other: { name: 'other', state: 'online' } } }
        }, function (deviation) {
            assert.ok(false, 'should not happen');
        });
    });

    it('amender - promotion', function () {
        new PolicyEngine([
            {
                target: 'service=online',
                transform: 'count',
                min: 3,
                max: 5,
                amend: 'promotion',
                candidates: ['standby', 'offline'],
                degrade: 'standby'
            }
        ]).evaluate({
            n01: { roles: { service: { name: 'service', state: 'online' } } },
            n02: { roles: { service: { name: 'service', state: 'standby' } } },
            n03: { roles: { service: { name: 'service', state: 'offline' } } },
            n04: { roles: { other: { name: 'other', state: 'online' } } }
        }, function (deviation) {
            assert.equal(deviation.action, 'enforce');
            assert.deepEqual(deviation.rules, [{ name: 'service', state: 'online' }]);
            assert.deepEqual(deviation.targets.sort(), ['n02', 'n03']);
        }).evaluate({
            n01: { roles: { service: { name: 'service', state: 'online' } } },
            n02: { roles: { service: { name: 'service', state: 'online' } } },
            n03: { roles: { service: { name: 'service', state: 'online' } } },
            n04: { roles: { service: { name: 'service', state: 'online' } } },
            n05: { roles: { service: { name: 'service', state: 'online' } } },
            n06: { roles: { service: { name: 'service', state: 'online' } } }
        }, function (deviation) {
            assert.equal(deviation.action, 'enforce');
            assert.deepEqual(deviation.rules, [{ name: 'service', state: 'standby' }]);
            assert.equal(deviation.targets.length, 1);
        }).evaluate({
            n01: { roles: { service: { name: 'service', state: 'offline' } } }
        }, function (deviation) {
            assert.equal(deviation.action, 'enforce');
            assert.deepEqual(deviation.rules, [{ name: 'service', state: 'online' }]);
            assert.deepEqual(deviation.targets, ['n01']);
        });
    });
});