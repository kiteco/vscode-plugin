const expect = require('expect.js');
const jsdom = require('mocha-jsdom');
const sinon = require('sinon');
const {keydown, createEvent, click} = require('widjet-test-utils/events');
const {delay} = require('../helpers');

describe.only('initSearch', () => {
  let clock, form, results, view, input;

  jsdom();

  beforeEach(() => {
    require('../../assets/js/search');

    document.body.innerHTML = `
    <div class="search-form">
      <input type="text" id="text" placeholder="Search identifier…"></input>
      <i class="icon icon-search"></i>
    </div>

    <div id="results"><ul></ul></div>
    <div id="view"></div>
    `;

    window.createJumpTo = sinon.spy();
    window.handleExternalLinks = sinon.spy();
    window.handleCollapsibles = sinon.spy();

    window.requestGet = sinon.stub().returns(Promise.resolve(''));
    window.requestPost = sinon.stub().returns(Promise.resolve(''));

    form = document.querySelector('.search-form');
    input = form.querySelector('input');
    results = document.querySelector('#results');
    view = document.querySelector('#view');
  });

  describe('with no history', () => {
    beforeEach(() => {
      window.initSearch('text', 'results', 'view', undefined, ['json'], 0);
    });
    describe('typing an empty string in the input field', () => {
      beforeEach(() => {
        let event = createEvent('Event', 'input');
        input.value = ''
        input.dispatchEvent(event);
      });
  
      it('does not make a request to the search endpoint', () => {
        expect(window.requestGet.calledWith('/search?text=')).not.to.be.ok()
      });
    });
    
    describe('clicking a suggested entry', () => {
      it('makes a search with that term', () => {
        const li = view.querySelector('li');
        
        click(li);
        
        return delay(0, () => {
          expect(window.requestGet.calledWith('/search?text=json')).to.be.ok()
        });
      })
    });
  
    describe('typing a non empty string in the input field', () => {
      describe('when the search return results', () => {
        beforeEach(() => {
          window.requestGet = sinon.stub().returns(Promise.resolve(''));
          window.requestGet.onCall(1).returns(Promise.resolve([
            '<li data-id="some-id-1">Some label 1</li>',
            '<li data-id="some-id-2">Some label 2</li>',
            '<li data-id="some-id-3">Some label 3</li>',
          ].join('')));
          window.requestGet.onCall(2).returns(Promise.resolve('<div>Some view content</div>'));
  
          let event = createEvent('Event', 'input');
          input.value = 'foo'
          input.dispatchEvent(event);
        });
    
        it('makes a request to the metric endpoint', () => {
          expect(window.requestGet.calledWith('/count?metric=requested&name=active_search')).to.be.ok()
        });
        
        it('makes a request to the search endpoint', () => {
          return delay(0, () => {
            expect(window.requestGet.calledWith('/search?text=foo')).to.be.ok()
          })
        });
        
        describe('when the results are received', () => {
          it('renders them in the results list', () => {
            return delay(0, () => {
              expect(results.querySelectorAll('li').length).to.eql(3);
            });
          });
          
          it('selects the first element in the list', () => {
            return delay(0, () => {
              expect(results.querySelector('li.selected')).not.to.be(undefined);
            });
          });
          
          it('requests the view content for the first item', () => {
            return delay(0, () => {
              expect(window.requestGet.calledWith('/view?id=some-id-1')).to.be.ok()
            });
          });
          
          describe('when the item view is loaded', () => {
            it('renders the returned html in the view', () => {
              expect(view.textContent).to.eql('Some view content');
            });
  
            it('initializes various widgets in the generated view', () => {
              return delay(0, () => {
                expect(window.createJumpTo.called).to.be.ok();
                expect(window.handleExternalLinks.called).to.be.ok();
                expect(window.handleCollapsibles.called).to.be.ok();
              });
            });
            it('calls the history endpoint after the specified duration', () => {
              return delay(1, () => {
                expect(window.requestPost.calledWith('/search/stack')).to.be.ok()
              })
            });
          });
  
          describe('then typing an empty string in the input field', () => {
            beforeEach(() => {
              let event = createEvent('Event', 'input');
              input.value = ''
              input.dispatchEvent(event);
            });
        
            it('clears the results and the views', () => {
              return delay(0, () => {
                expect(results.textContent).to.eql('Type any identifier above to search docs, popular patterns, signatures and more.');
              })
            });

            it('restores the search suggestions', () => {
              return delay(0, () => {
                expect(view.querySelector('h4').textContent).to.eql('Examples to get you started');
                expect(view.querySelectorAll('ul.history li').length).to.eql(1);
                expect(view.querySelector('ul.history li').textContent).to.eql('json');
              });
            });
          });
  
          describe('using keyboard navigation', () => {
            describe('to the bottom', () => {
              it('moves the selection down and then cycle up', () => {
                keydown(document.body, {key: 'ArrowDown'});
                expect(results.querySelector('li.selected:nth-child(2)')).not.to.be(undefined);
                
                keydown(document.body, {key: 'ArrowDown'});
                expect(results.querySelector('li.selected:nth-child(3)')).not.to.be(undefined);
                
                keydown(document.body, {key: 'ArrowDown'});
                expect(results.querySelector('li.selected:nth-child(1)')).not.to.be(undefined);
              });
              
              it('loads the view for the new selected item', () => {
                keydown(document.body, {key: 'ArrowDown'});
                expect(window.requestGet.calledWith('/view?id=some-id-2')).to.be.ok();
              });
            });
  
            describe('to the top', () => {
              it('moves the selection up and then cycle down', () => {
                keydown(document.body, {key: 'ArrowUp'});
                expect(results.querySelector('li.selected:nth-child(3)')).not.to.be(undefined);
                
                keydown(document.body, {key: 'ArrowUp'});
                expect(results.querySelector('li.selected:nth-child(2)')).not.to.be(undefined);
                
                keydown(document.body, {key: 'ArrowUp'});
                expect(results.querySelector('li.selected:nth-child(1)')).not.to.be(undefined);
              });
  
              it('loads the view for the new selected item', () => {
                keydown(document.body, {key: 'ArrowDown'});
                expect(window.requestGet.calledWith('/view?id=some-id-2')).to.be.ok();
              });
            });
          });
          
          describe('clicking on a result item', () => {
            it('select that item and loads its view', () => {
              const li = results.querySelector('li:nth-child(2)');
              click(li);
              
              expect(results.querySelector('li.selected:nth-child(2)')).not.to.be(undefined);
              expect(window.requestGet.calledWith('/view?id=some-id-2')).to.be.ok();
            });
          });
        });
      })
    });
  });

  describe('with some history', () => {
    beforeEach(() => {
      window.initSearch('text', 'results', 'view', ['some', 'history', 'entries'], ['json'], 0);
    });

    it('renders the history in place of the suggested examples', () => {
      expect(view.querySelectorAll('li').length).to.eql(3);
      expect(view.querySelector('ul').textContent).to.eql('somehistoryentries');
    })

    describe('clicking a suggested entry', () => {
      it('makes a search with that term', () => {
        const li = view.querySelector('li');
        
        click(li);
        
        return delay(0, () => {
          expect(window.requestGet.calledWith('/search?text=some')).to.be.ok()
        });
      })
    })
  });
});