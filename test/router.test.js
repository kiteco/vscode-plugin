const vscode = require('vscode');
const jsdom = require('mocha-jsdom');
const KiteRouter = require('../src/router');
const {fixtureURI, withRoutes, withKiteWhitelistedPaths, fakeResponse, log} = require('./helpers');

const {
  hasMembersSection, hasDocsSection, hasHeaderSection, hasExamplesSection, hasLinksSection,
  hasArgumentsSection, hasUsagesSection,
} = require('./section-helpers');

describe.only('router', () => {
  jsdom();

  let router;

  withKiteWhitelistedPaths([__dirname], () => {
    beforeEach(() => {
      router = new KiteRouter();
    })

    describe('member route', () => {
      describe('for a module', () => {
        const source = require(fixtureURI('module-os.json'));
        
        withRoutes([
          [
            o => /\/api\/editor\/symbol\//.test(o.path),
            o => fakeResponse(200, JSON.stringify(source))
          ]
        ])
  
        beforeEach(() => {
          router.registerNavigationStep(vscode.Uri.parse('kite-vscode-sidebar://member/python;foo'));
          
          return router.provideTextDocumentContent().then(html => document.body.innerHTML = html);
        });
  
        hasHeaderSection('os module');
  
        hasMembersSection(5, source.symbol.value[0].id);
        
        hasDocsSection(source.report.description_html);
        
        hasExamplesSection(2, source.symbol.id, source.report.examples);
        
        hasLinksSection(2, source.symbol.id, source.report.links);
      });

      describe('for a type', () => {
        const source = require(fixtureURI('s3connection.json'));
        
        withRoutes([
          [
            o => /\/api\/editor\/symbol\//.test(o.path),
            o => fakeResponse(200, JSON.stringify(source))
          ]
        ])
        
        beforeEach(() => {
          router.registerNavigationStep(vscode.Uri.parse('kite-vscode-sidebar://member/python;foo'));
          
          return router.provideTextDocumentContent()
          .then(html => document.body.innerHTML = html);
        });
        
        hasHeaderSection('boto.s3.connection.S3Connection(aws_access_key_id=None, aws_secret_access_key=None, is_secure=bool, port=None, proxy=None, proxy_port=None, proxy_user=None, proxy_pass=None, host=__builtin__, debug=int, https_connection_factory=None, calling_format=str, path=str, provider=str, bucket_class=__builtin__, security_token=None, suppress_consec_slashes=bool, anon=bool, validate_certs=None, profile_name=None) type');
        
        hasArgumentsSection(source.symbol.value[0].details.type.language_details.python.constructor, source.language);

        hasMembersSection(5, source.symbol.value[0].id);
        
        hasDocsSection(source.report.description_html);
      });
      
      describe('for a function', () => {
        const source = require(fixtureURI('dumps.json'));
        
        withRoutes([
          [
            o => /\/api\/editor\/symbol\//.test(o.path),
            o => fakeResponse(200, JSON.stringify(source))
          ]
        ])
        
        beforeEach(() => {
          router.registerNavigationStep(vscode.Uri.parse('kite-vscode-sidebar://member/python;foo'));
          
          return router.provideTextDocumentContent()
          .then(html => document.body.innerHTML = html);
        });
        
        hasHeaderSection('json.dumps(obj, skipkeys=bool, ensure_ascii=bool, check_circular=bool, allow_nan=bool, cls=None, indent=None, separators=None, encoding=str, default=None, sort_keys=bool, **kw) function');
        
        hasArgumentsSection(source.symbol.value[0].details.function, source.language);
        
        hasDocsSection(source.report.description_html);
        
        hasUsagesSection(source.report.usages);
  
        hasExamplesSection(2, source.symbol.id, source.report.examples);
        
        hasLinksSection(2, source.symbol.id, source.report.links);
      });

      describe('for an instance', () => {
        const source = require(fixtureURI('test-instance.json'));
        
        withRoutes([
          [
            o => /\/api\/editor\/symbol\//.test(o.path),
            o => fakeResponse(200, JSON.stringify(source))
          ]
        ])
        
        beforeEach(() => {
          router.registerNavigationStep(vscode.Uri.parse('kite-vscode-sidebar://member/python;foo'));
          
          return router.provideTextDocumentContent()
          .then(html => document.body.innerHTML = html);
        });
        
        hasHeaderSection('test B');
        
        hasDocsSection(source.report.description_html);
        
        hasUsagesSection(source.report.usages);
      });
    });

    describe('link route', () => {
      describe('for a module', () => {
        const source = require(fixtureURI('module-os.json'));
        
        withRoutes([
          [
            o => /\/api\/editor\/symbol\//.test(o.path),
            o => fakeResponse(200, JSON.stringify(source))
          ]
        ])
  
        beforeEach(() => {
          router.registerNavigationStep(vscode.Uri.parse('kite-vscode-sidebar://link/python;foo'));
          
          return router.provideTextDocumentContent().then(html => document.body.innerHTML = html);
        });
  
        hasHeaderSection('os module');
  
        hasMembersSection(5, source.symbol.value[0].id);
        
        hasDocsSection(source.report.description_html);
        
        hasExamplesSection(2, source.symbol.id, source.report.examples);
        
        hasLinksSection(2, source.symbol.id, source.report.links);
      });

      describe('for a type', () => {
        const source = require(fixtureURI('s3connection.json'));
        
        withRoutes([
          [
            o => /\/api\/editor\/symbol\//.test(o.path),
            o => fakeResponse(200, JSON.stringify(source))
          ]
        ])
        
        beforeEach(() => {
          router.registerNavigationStep(vscode.Uri.parse('kite-vscode-sidebar://link/python;foo'));
          
          return router.provideTextDocumentContent()
          .then(html => document.body.innerHTML = html);
        });
        
        hasHeaderSection('boto.s3.connection.S3Connection(aws_access_key_id=None, aws_secret_access_key=None, is_secure=bool, port=None, proxy=None, proxy_port=None, proxy_user=None, proxy_pass=None, host=__builtin__, debug=int, https_connection_factory=None, calling_format=str, path=str, provider=str, bucket_class=__builtin__, security_token=None, suppress_consec_slashes=bool, anon=bool, validate_certs=None, profile_name=None) type');
        
        hasArgumentsSection(source.symbol.value[0].details.type.language_details.python.constructor, source.language);

        hasMembersSection(5, source.symbol.value[0].id);
        
        hasDocsSection(source.report.description_html);
      });
      
      describe('for a function', () => {
        const source = require(fixtureURI('dumps.json'));
        
        withRoutes([
          [
            o => /\/api\/editor\/symbol\//.test(o.path),
            o => fakeResponse(200, JSON.stringify(source))
          ]
        ])
        
        beforeEach(() => {
          router.registerNavigationStep(vscode.Uri.parse('kite-vscode-sidebar://link/python;foo'));
          
          return router.provideTextDocumentContent()
          .then(html => document.body.innerHTML = html);
        });
        
        hasHeaderSection('json.dumps(obj, skipkeys=bool, ensure_ascii=bool, check_circular=bool, allow_nan=bool, cls=None, indent=None, separators=None, encoding=str, default=None, sort_keys=bool, **kw) function');
        
        hasArgumentsSection(source.symbol.value[0].details.function, source.language);
        
        hasDocsSection(source.report.description_html);
        
        hasUsagesSection(source.report.usages);
  
        hasExamplesSection(2, source.symbol.id, source.report.examples);
        
        hasLinksSection(2, source.symbol.id, source.report.links);
      });

      describe('for an instance', () => {
        const source = require(fixtureURI('test-instance.json'));
        
        withRoutes([
          [
            o => /\/api\/editor\/symbol\//.test(o.path),
            o => fakeResponse(200, JSON.stringify(source))
          ]
        ])
        
        beforeEach(() => {
          router.registerNavigationStep(vscode.Uri.parse('kite-vscode-sidebar://link/python;foo'));
          
          return router.provideTextDocumentContent()
          .then(html => document.body.innerHTML = html);
        });
        
        hasHeaderSection('test B');
        
        hasDocsSection(source.report.description_html);
        
        hasUsagesSection(source.report.usages);
      });
    });

    describe('value route', () => {
      describe('for a module', () => {
        const source = require(fixtureURI('module-os.json'));
        
        withRoutes([
          [
            o => /\/api\/editor\/symbol\//.test(o.path),
            o => fakeResponse(200, JSON.stringify(source))
          ]
        ])
  
        beforeEach(() => {
          router.registerNavigationStep(vscode.Uri.parse('kite-vscode-sidebar://value/python;foo'));
          
          return router.provideTextDocumentContent().then(html => document.body.innerHTML = html);
        });
  
        hasHeaderSection('os module');
  
        hasMembersSection(5, source.symbol.value[0].id);
        
        hasDocsSection(source.report.description_html);
        
        hasExamplesSection(2, source.symbol.id, source.report.examples);
        
        hasLinksSection(2, source.symbol.id, source.report.links);
      });

      describe('for a type', () => {
        const source = require(fixtureURI('s3connection.json'));
        
        withRoutes([
          [
            o => /\/api\/editor\/symbol\//.test(o.path),
            o => fakeResponse(200, JSON.stringify(source))
          ]
        ])
        
        beforeEach(() => {
          router.registerNavigationStep(vscode.Uri.parse('kite-vscode-sidebar://value/python;foo'));
          
          return router.provideTextDocumentContent()
          .then(html => document.body.innerHTML = html);
        });
        
        hasHeaderSection('boto.s3.connection.S3Connection(aws_access_key_id=None, aws_secret_access_key=None, is_secure=bool, port=None, proxy=None, proxy_port=None, proxy_user=None, proxy_pass=None, host=__builtin__, debug=int, https_connection_factory=None, calling_format=str, path=str, provider=str, bucket_class=__builtin__, security_token=None, suppress_consec_slashes=bool, anon=bool, validate_certs=None, profile_name=None) type');
        
        hasArgumentsSection(source.symbol.value[0].details.type.language_details.python.constructor, source.language);

        hasMembersSection(5, source.symbol.value[0].id);
        
        hasDocsSection(source.report.description_html);
      });
      
      describe('for a function', () => {
        const source = require(fixtureURI('dumps.json'));
        
        withRoutes([
          [
            o => /\/api\/editor\/symbol\//.test(o.path),
            o => fakeResponse(200, JSON.stringify(source))
          ]
        ])
        
        beforeEach(() => {
          router.registerNavigationStep(vscode.Uri.parse('kite-vscode-sidebar://value/python;foo'));
          
          return router.provideTextDocumentContent()
          .then(html => document.body.innerHTML = html);
        });
        
        hasHeaderSection('json.dumps(obj, skipkeys=bool, ensure_ascii=bool, check_circular=bool, allow_nan=bool, cls=None, indent=None, separators=None, encoding=str, default=None, sort_keys=bool, **kw) function');
        
        hasArgumentsSection(source.symbol.value[0].details.function, source.language);
        
        hasDocsSection(source.report.description_html);
        
        hasUsagesSection(source.report.usages);
  
        hasExamplesSection(2, source.symbol.id, source.report.examples);
        
        hasLinksSection(2, source.symbol.id, source.report.links);
      });

      describe('for an instance', () => {
        const source = require(fixtureURI('test-instance.json'));
        
        withRoutes([
          [
            o => /\/api\/editor\/symbol\//.test(o.path),
            o => fakeResponse(200, JSON.stringify(source))
          ]
        ])
        
        beforeEach(() => {
          router.registerNavigationStep(vscode.Uri.parse('kite-vscode-sidebar://value/python;foo'));
          
          return router.provideTextDocumentContent()
          .then(html => document.body.innerHTML = html);
        });
        
        hasHeaderSection('test B');
        
        hasDocsSection(source.report.description_html);
        
        hasUsagesSection(source.report.usages);
      });
    });

    describe('value-range route', () => {
      describe('for a function', () => {
        const source = require(fixtureURI('dumps-hover.json'));
        
        withRoutes([
          [
            o => /\/api\/buffer\/vscode\//.test(o.path),
            o => fakeResponse(200, JSON.stringify(source))
          ]
        ])
        
        beforeEach(() => {
          const uri = vscode.Uri.file(fixtureURI('sample.py'));
          
          return vscode.workspace.openTextDocument(uri).then(doc => {
            Object.defineProperty(vscode.window, 'activeTextEditor', {
              get: () => ({document: doc}),
              configurable: true,
            });
          });
        });

        beforeEach(() => {
          router.registerNavigationStep(vscode.Uri.parse('kite-vscode-sidebar://value-range/[{"line":5,"character":20}, {"line":5,"character":26}]'));
          
          return router.provideTextDocumentContent()
          .then(html => {
            return html;
          })
          .then(html => document.body.innerHTML = html);
        });
        
        hasHeaderSection('json.dumps(obj, skipkeys=bool, ensure_ascii=bool, check_circular=bool, allow_nan=bool, cls=None, indent=None, separators=None, encoding=str, default=None, sort_keys=bool, **kw) function');
        
        hasArgumentsSection(source.symbol[0].value[0].details.function, source.language);
        
        hasDocsSection(source.report.description_html);
        
        hasUsagesSection(source.report.usages);
  
        hasExamplesSection(2, source.symbol[0].id, source.report.examples);
        
        hasLinksSection(2, source.symbol[0].id, source.report.links);
      });
    });
  });
});