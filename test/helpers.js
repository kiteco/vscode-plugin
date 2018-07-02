'use strict';

const os = require('os');
const path = require('path');
const http = require('http');
const proc = require('child_process');
const sinon = require('sinon');
const {StateController, Logger} = require('kite-installer');
const Plan = require('../src/plan');
const {merge, promisifyRequest, promisifyReadResponse} = require('../src/utils');

Logger.LEVEL = Logger.LEVELS.ERROR;

const Kite = {
  request(req, data) {
    return promisifyRequest(StateController.client.request(req, data))
    .then(resp => {
      
      if (resp.statusCode !== 200) {
        return promisifyReadResponse(resp).then(data => {
          const err = new Error(`bad status ${resp.statusCode}: ${data}`);
          err.status = resp.statusCode;
          throw err;
        })
      }
      return promisifyReadResponse(resp);
    })
    .catch(err => {
      this.checkState();
      throw err;
    });
  },
}

function waitsFor(m, f, t, i) {
  if (typeof m === 'function') {
    i = t;
    t = f;
    f = m;
    m = 'something to happen';
  }

  const intervalTime = i || 10;
  const timeoutDuration = t || 1500;

  return new Promise((resolve, reject) => {
    const interval = setInterval(() => {
      try {
        if (f()) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve();
        }
      } catch(err) {
        reject(err);
      }
    }, intervalTime);

    const timeout = setTimeout(() => {
      clearInterval(interval);
      reject(new Error(`Waited ${timeoutDuration}ms for ${m} but nothing happened`));
    }, timeoutDuration);
  });
}

function sleep(duration) {
  const t = new Date();
  return waitsFor(`${duration}ms`, () => { return new Date() - t > duration; });
}

function delay(duration, block) {
  return new Promise((resolve) => {
    setTimeout(() => {
      block();
      resolve();
    }, duration);
  });
}

function fakeStdStream() {
  let streamCallback;
  function stream(data) {
    streamCallback && streamCallback(data);
  }

  stream.on = (evt, callback) => {
    if (evt === 'data') { streamCallback = callback; }
  };

  return stream;
}

let _processes;
function fakeProcesses(processes) {
  if (proc.spawn.isSinonProxy) {
    _processes = merge(_processes, processes);
  } else {
    sinon.stub(proc, 'spawn').callsFake((process, options) => {
      const mock = _processes[process];
      const ps = {
        stdout: fakeStdStream(),
        stderr: fakeStdStream(),
        on: (evt, callback) => {
          if (evt === 'close') { callback(mock ? mock(ps, options) : 1); }
        },
      };

      return ps;
    });

    sinon.stub(proc, 'spawnSync').callsFake((process, options) => {
      const mock = _processes[process];

      const ps = {};
      ps.status = mock ? mock({
        stdout(data) { ps.stdout = data; },
        stderr(data) { ps.stderr = data; },
      }, options) : 1;

      return ps;
    });


    _processes = processes;
  }

  if (processes.exec && !proc.exec.isSinonProxy) {
    sinon.stub(proc, 'exec').callsFake((process, options, callback) => {
      const mock = _processes.exec[process];

      let stdout, stderr;

      const status = mock ? mock({
        stdout(data) { stdout = data; },
        stderr(data) { stderr = data; },
      }, options) : 1;

      status === 0
      ? callback(null, stdout)
      : callback({}, stdout, stderr);
    });
  }
}

function fakeResponse(statusCode, data, props) {
  data = data || '';
  props = props || {};

  const resp = {
    statusCode,
    req: {},
    on(event, callback) {
      switch (event) {
        case 'data':
          callback(data);
          break;
        case 'end':
          callback();
          break;
      }
    },
  };
  for (let k in props) { resp[k] = props[k]; }
  resp.headers = resp.headers || {};
  return resp;
}

function decorateResponse(resp, req) {
  resp.request = req;
  return resp;
}

function fakeRequestMethod(resp) {
  if (resp) {
    switch (typeof resp) {
      case 'boolean':
        resp = resp ? fakeResponse(200) : fakeResponse(500);
        break;
      case 'object':
        resp = fakeResponse(200, '', resp);
        break;
      case 'string':
        resp = fakeResponse(200, resp, {});
        break;
    }
  }

  return (opts, callback) => {
    const req = {
      opts,
      on(type, cb) {
        switch (type) {
          case 'error':
            if (resp === false) { cb({}); }
            break;
          case 'response':
            if (resp) { cb(decorateResponse(typeof resp == 'function' ? resp(opts) : resp), req); }
            break;
        }
      },
      end() {
        if (resp && callback) {
          typeof resp == 'function'
            ? callback(decorateResponse(resp(opts, this), req))
            : callback(decorateResponse(resp, req));
        }
      },
      write(data) {
        this.data = data;
      },
      setTimeout(timeout, callback) {
        if (resp == null) { callback({}); }
      },
    };
    return req;
  };
}

function fakeKiteInstallPaths() {
  beforeEach(() => {
    fakeProcesses({
      'mdfind': (ps) => {
        ps.stdout('');
        return 0;
      },
    });
  });
}

function fakeRouter(routes) {
  return (opts, req) => {
    for (let i = 0; i < routes.length; i++) {
      const [predicate, handler] = routes[i];
      if (predicate(opts, req)) { return handler(opts, req); }
    }
    return fakeResponse(200);
  };
}

function withKiteInstalled(block) {
  describe('with kite installed', () => {
    fakeKiteInstallPaths();

    beforeEach(() => {
      fakeProcesses({
        'mdfind': (ps, args) => {
          const [, key] = args[0].split(/\s=\s/);
          key === '"com.kite.Kite"'
          ? ps.stdout('/Applications/Kite.app')
          : ps.stdout('');
          return 0;
        },
      });
    });

    block();
  });
}

function withManyKiteInstalled(block) {
  describe('with many kite installed', () => {
    fakeKiteInstallPaths();

    beforeEach(() => {
      fakeProcesses({
        'mdfind': (ps, args) => {
          const [, key] = args[0].split(/\s=\s/);
          key === '"com.kite.Kite"'
          ? ps.stdout('/Applications/Kite.app\n/Users/kite/Kite.app')
          : ps.stdout('');
          return 0;
        },
      });
    });

    block();
  });
}

function withKiteEnterpriseInstalled(block) {
  describe('with kite enterprise installed', () => {
    fakeKiteInstallPaths();

    beforeEach(() => {
      fakeProcesses({
        'mdfind': (ps, args) => {
          const [, key] = args[0].split(/\s=\s/);
          key === '"enterprise.kite.Kite"'
          ? ps.stdout('/Applications/KiteEnterprise.app')
          : ps.stdout('');
          return 0;
        },
      });
    });

    block();
  });
}

function withManyKiteEnterpriseInstalled(block) {
  describe('with many kite enterprise installed', () => {
    fakeKiteInstallPaths();

    beforeEach(() => {
      fakeProcesses({
        'mdfind': (ps, args) => {
          const [, key] = args[0].split(/\s=\s/);
          key === '"enterprise.kite.Kite"'
          ? ps.stdout('/Applications/KiteEnterprise.app\n/Users/kite/KiteEnterprise.app')
          : ps.stdout('');
          return 0;
        },
      });
    });

    block();
  });
}

function withBothKiteInstalled(block) {
  describe('with both kite and kite enterprise installed', () => {
    fakeKiteInstallPaths();

    beforeEach(() => {
      fakeProcesses({
        'mdfind': (ps, args) => {
          const [, key] = args[0].split(/\s=\s/);
          key === '"enterprise.kite.Kite"'
          ? ps.stdout('/Applications/KiteEnterprise.app')
          : ps.stdout('/Applications/Kite.app');
          return 0;
        },
      });
    });

    block();
  });
}

function withManyOfBothKiteInstalled(block) {
  describe('with many of both kite and kite enterprise installed', () => {
    fakeKiteInstallPaths();

    beforeEach(() => {
      fakeProcesses({
        'mdfind': (ps, args) => {
          const [, key] = args[0].split(/\s=\s/);
          key === '"enterprise.kite.Kite"'
          ? ps.stdout('/Applications/KiteEnterprise.app\n/Users/kite/KiteEnterprise.app')
          : ps.stdout('/Applications/Kite.app\n/Users/kite/Kite.app');
          return 0;
        },
      });
    });

    block();
  });
}

function fixtureURI (filepath) {
  return path.resolve(__dirname, 'fixtures', filepath);
}

function withKiteRunning(block) {
  withKiteInstalled(() => {
    describe(', running', () => {
      beforeEach(() => {
        fakeProcesses({
          ls: (ps) => ps.stdout('kite'),
          '/bin/ps': (ps) => {
            ps.stdout('Kite');
            return 0;
          },
        });
      });

      block();
    });
  });
}

function withKiteNotRunning(block) {
  withKiteInstalled(() => {
    describe(', not running', () => {
      beforeEach(() => {
        fakeProcesses({
          '/bin/ps': (ps) => {
            ps.stdout('');
            return 0;
          },
          defaults: () => 0,
          open: () => 0,
        });
      });

      block();
    });
  });
}

function withManyKiteNotRunning(block) {
  withManyKiteInstalled(() => {
    describe(', not running', () => {
      beforeEach(() => {
        fakeProcesses({
          '/bin/ps': (ps) => {
            ps.stdout('');
            return 0;
          },
          defaults: () => 0,
          open: () => 0,
        });
      });

      block();
    });
  });
}

function withKiteEnterpriseRunning(block) {
  withKiteEnterpriseInstalled(() => {
    describe(', running', () => {
      beforeEach(() => {
        fakeProcesses({
          '/bin/ps': (ps) => {
            ps.stdout('KiteEnterprise');
            return 0;
          },
        });
      });

      block();
    });
  });
}

function withKiteEnterpriseNotRunning(block) {
  withKiteEnterpriseInstalled(() => {
    describe(', not running', () => {
      beforeEach(() => {
        fakeProcesses({
          '/bin/ps': (ps) => {
            ps.stdout('');
            return 0;
          },
          defaults: () => 0,
          open: () => 0,
        });
      });

      block();
    });
  });
}

function withManyKiteEnterpriseNotRunning(block) {
  withManyKiteEnterpriseInstalled(() => {
    describe(', not running', () => {
      beforeEach(() => {
        fakeProcesses({
          '/bin/ps': (ps) => {
            ps.stdout('');
            return 0;
          },
          defaults: () => 0,
          open: () => 0,
        });
      });

      block();
    });
  });
}

function withBothKiteNotRunning(block) {
  withBothKiteInstalled(() => {
    describe(', not running', () => {
      beforeEach(() => {
        fakeProcesses({
          '/bin/ps': (ps) => {
            ps.stdout('');
            return 0;
          },
          defaults: () => 0,
          open: () => 0,
        });
      });

      block();
    });
  });
}

function withManyOfBothKiteNotRunning(block) {
  withManyOfBothKiteInstalled(() => {
    describe(', not running', () => {
      beforeEach(() => {
        fakeProcesses({
          '/bin/ps': (ps) => {
            ps.stdout('');
            return 0;
          },
          defaults: () => 0,
          open: () => 0,
        });
      });

      block();
    });
  });
}

function withFakeServer(routes, block) {
  if (typeof routes == 'function') {
    block = routes;
    routes = [];
  }

  routes.push([o => true, o => fakeResponse(404)]);

  describe('', () => {
    beforeEach(function() {
      this.routes = routes.concat();
      const router = fakeRouter(this.routes);
      sinon.stub(http, 'request').callsFake(fakeRequestMethod(router));
    });

    afterEach(() => {
      http.request.restore();
    })

    block();
  });
}

function withKiteReachable(routes, block) {
  if (typeof routes == 'function') {
    block = routes;
    routes = [];
  }

  routes.push([o => o.path === '/system', o => fakeResponse(200)]);
  routes.push([o => o.path === '/clientapi/user', o => fakeResponse(200, '{}')]);
  routes.push([o => o.path.indexOf('/clientapi/status') === 0, o => fakeResponse(200, '{"status": "ready"}')]);
  routes.push([o => o.path.indexOf('/clientapi/plan') !== -1, o => fakeResponse(200, '{}')]);

  withKiteRunning(() => {
    describe(', reachable', () => {
      withFakeServer(routes, () => {
        block();
      });
    });
  });
}

function withKiteNotReachable(block) {
  withKiteRunning(() => {
    describe(', not reachable', () => {
      beforeEach(() => {
        sinon.stub(http, 'request').callsFake(fakeRequestMethod(false));
      });

      block();
    });
  });
}

function withKiteAuthenticated(routes, block) {
  if (typeof routes == 'function') {
    block = routes;
    routes = [];
  }

  routes.push([
    o => /^\/api\/account\/authenticated/.test(o.path),
    o => fakeResponse(200, 'authenticated'),
  ]);

  withKiteReachable(routes, () => {
    describe(', authenticated', () => {
      block();
    });
  });
}

function withKiteNotAuthenticated(block) {
  withKiteReachable([
    [o => o.path === '/api/account/authenticated', o => fakeResponse(401)],
  ], () => {
    describe(', not authenticated', () => {
      block();
    });
  });
}

function withKiteWhitelistedPaths(paths, block) {
  if (typeof paths == 'function') {
    block = paths;
    paths = [];
  }

  const eventRe = /^\/clientapi\/editor\/event$/;
  const authRe = /^\/clientapi\/permissions\/authorized\?filename=(.+)$/;
  const projectDirRe = /^\/clientapi\/projectdir\?filename=(.+)$/;
  const notifyRe = /^\/clientapi\/permissions\/notify\?filename=(.+)$/;

  const whitelisted = match => {
    const path = match.replace(/:/g, '/');
    return paths.some(p => path.indexOf(p) !== -1);
  };

  const routes = [
    [
      o => eventRe.test(o.path),
      (o, r) => whitelisted(JSON.parse(r.data).filename) ? fakeResponse(200) : fakeResponse(403),
    ], [
      o => {
        const match = authRe.exec(o.path);
        return match && whitelisted(match[1]);
      },
      o => fakeResponse(200),
    ], [
      o => {
        const match = authRe.exec(o.path);
        return match && !whitelisted(match[1]);
      },
      o => fakeResponse(403),
    ], [
      o => projectDirRe.test(o.path),
      o => fakeResponse(200, os.homedir()),
    ], [
      o => notifyRe.test(o.path),
      o => fakeResponse(200),
    ],
  ];

  withKiteAuthenticated(routes, () => {
    describe('with whitelisted paths', () => {
      block();
    });
  });
}

function withKiteIgnoredPaths(paths) {
  const authRe = /^\/clientapi\/permissions\/authorized\?filename=(.+)$/;
  const ignored = match => {
    const path = match.replace(/:/g, '/');
    return paths.some(p => path.indexOf(p) !== -1);
  };

  withKiteBlacklistedPaths(paths);
  withRoutes([
    [
      o => {
        const match = authRe.exec(o.path);
        return match && ignored(match[1]);
      },
      o => fakeResponse(403),
    ],
  ]);
}

function withKiteBlacklistedPaths(paths) {
  // console.log(paths)
  const notifyRe = /^\/clientapi\/permissions\/notify\?filename=(.+)$/;
  const blacklisted = path => paths.some(p => path.indexOf(p) !== -1);

  withRoutes([
    [
      o => {
        const match = notifyRe.exec(o.path);
        // console.log('blacklist match', match, o.path, match && blacklisted(match[1]))
        return match && blacklisted(match[1]);
      },
      o => fakeResponse(403),
    ],
  ]);
}

function withRoutes(routes) {
  beforeEach(function() {
    routes.reverse().forEach(route => this.routes.unshift(route));
  });
}

function withPlan(description, plan, block) {
  describe(description, () => {
    withRoutes([
      [
        o => o.path.indexOf('/clientapi/plan') === 0,
        o => fakeResponse(200, JSON.stringify(plan)),
      ], [
        o => o.path.indexOf('/clientapi/status') === 0,
        o => fakeResponse(200, JSON.stringify({status: 'ready'})),
      ], [
        o => /^\/api\/account\/user/.test(o.path),
        o => fakeResponse(200, JSON.stringify({email_verified: true})),
      ],
    ]);


    beforeEach(() => Plan.queryPlan());

    block();
  });
}

function withFakePlan(description, plan, block) {
  describe(description, () => {
    beforeEach(() => {
      Plan.plan = plan;
    });

    block();
  });
}

function log(v) {
  console.log(v);
  return v;
}

module.exports = {
  fakeProcesses, fakeRequestMethod, fakeResponse, fakeKiteInstallPaths,

  withKiteInstalled, withManyKiteInstalled,
  withKiteEnterpriseInstalled, withManyKiteEnterpriseInstalled,
  withBothKiteInstalled, withManyOfBothKiteInstalled,

  withKiteRunning, withKiteNotRunning, withManyKiteNotRunning,
  withKiteEnterpriseRunning, withKiteEnterpriseNotRunning,
  withManyKiteEnterpriseNotRunning,
  withBothKiteNotRunning, withManyOfBothKiteNotRunning,

  withKiteReachable, withKiteNotReachable,
  withKiteAuthenticated, withKiteNotAuthenticated,
  withKiteWhitelistedPaths, withKiteBlacklistedPaths, withKiteIgnoredPaths,
  withFakeServer, withRoutes, withPlan, withFakePlan,
  sleep, delay, fixtureURI, waitsFor,

  Kite, log,
};
