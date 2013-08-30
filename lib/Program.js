var Class  = require('js-class'),
    conf   = require('evo-elements').Config.conf(),

    Core    = require('./Core.js'),
    Router  = require('./Router'),
    Arbiter = require('./Arbiter');

var Program = Class({
    constructor: function () {
        this.core = new Core();

        this.router = new Router(this.core);
        this.arbiter = new Arbiter(this.core, { policies: conf.query('cords.policies', {}) });
    },

    run: function () {
        this.core.start();
    }
}, {
    statics: {
        run: function () {
            new Program().run();
        }
    }
});

module.exports = Program;