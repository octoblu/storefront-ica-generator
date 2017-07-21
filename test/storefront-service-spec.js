const { describe, beforeEach, afterEach } = global
const { expect, it } = global
const shmock = require("@octoblu/shmock")
const enableDestroy = require("server-destroy")
const path = require("path")
const url = require("url")
const fs = require("fs-extra")
const StoreFrontService = require('../')

describe('StoreFrontService', function() {
  beforeEach('setup', function () {
    this.storeFrontServer = shmock()
    enableDestroy(this.storeFrontServer)
    this.storeFrontUrl = url.format({
      hostname: 'localhost',
      pathname: 'Citrix/StoreWeb',
      port: this.storeFrontServer.address().port,
      protocol: 'http',
    })
    this.sut = new StoreFrontService({
      storeFrontUrl: this.storeFrontUrl,
      domain: 'some-domain',
      username: 'some-username',
      password: 'some-password',
      query: {
        name: 'some-desktop-name',
        type: 'Citrix.MPS.Desktop',
      }
    })
  })

  afterEach(function () {
    this.storeFrontServer.destroy()
  })

  describe('->generateICA', function() {
    beforeEach('generate-ica', function(done) {
      this.loadMainPage = this.storeFrontServer.get('/Citrix/StoreWeb')
        .set('Accept', 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8')
        .set('Upgrade-Insecure-Requests', '1')
        .reply(200, {}, {
          'Set-Cookie': 'CsrfToken=some-csrf-token'
        })

      this.homeConfiguration = this.storeFrontServer.post('/Citrix/StoreWeb/Home/Configuration')
        .set('Accept', 'application/xml, text/xml, */*; q=0.01')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('X-Citrix-IsUsingHTTPS', 'Yes')
        .set('Referer', this.storeFrontUrl)
        .set('Content-Length', '0')
        .reply(200, {}, {
          'Set-Cookie': 'CsrfToken=some-csrf-token'
        })

      this.checkResources = this.storeFrontServer.post('/Citrix/StoreWeb/Resources/List')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('Accept', 'application/json, text/javascript, */*; q=0.01')
        .set('X-Citrix-IsUsingHTTPS', "Yes")
        .set('Csrf-Token', 'some-csrf-token')
        .set('Referer', this.storeFrontUrl)
        .send({
          format: 'json',
          resourceDetails: 'Full',
        })
        .reply(200)

      this.getAuthMethods = this.storeFrontServer.post('/Citrix/StoreWeb/Authentication/GetAuthMethods')
        .set('Accept', 'application/xml, text/xml, */*; q=0.01')
        .set('X-Citrix-IsUsingHTTPS', "Yes")
        .set('Csrf-Token', 'some-csrf-token')
        .set('Referer', this.storeFrontUrl)
        .set('Content-Length', '0')
        .reply(200)

      this.explicitLogin = this.storeFrontServer.post('/Citrix/StoreWeb/ExplicitAuth/Login')
        .set('Accept', 'application/xml, text/xml, */*; q=0.01')
        .set('X-Citrix-IsUsingHTTPS', "Yes")
        .set('Csrf-Token', 'some-csrf-token')
        .set('Content-Length', '0')
        .reply(200)

      this.explicitLoginAttempt = this.storeFrontServer.post('/Citrix/StoreWeb/ExplicitAuth/LoginAttempt')
        .set('Accept', 'application/xml, text/xml, */*; q=0.01')
        .set('Accept-Language', 'en-US,en;q=0.8')
        .set('X-Requested-With', 'XMLHttpRequest')
        .set('X-Citrix-IsUsingHTTPS', "Yes")
        .set('Csrf-Token', 'some-csrf-token')
        .set('Referer', this.storeFrontUrl)
        .send({
          domain: 'some-domain',
          loginBtn: 'Log On',
          password: 'some-password',
          saveCredentials: "true",
          username: 'some-username',
          StateContext: '',
        })
        .reply(200)

      this.listResources = this.storeFrontServer.post('/Citrix/StoreWeb/Resources/List')
        .set('Content-Type', 'application/x-www-form-urlencoded')
        .set('Accept', 'application/json, text/javascript, */*; q=0.01')
        .set('X-Citrix-IsUsingHTTPS', "Yes")
        .set('Csrf-Token', 'some-csrf-token')
        .set('Referer', this.storeFrontUrl)
        .send({
          format: 'json',
          resourceDetails: 'Full',
        })
        .reply(200, {
          resources: [
            { name: 'some-desktop-name', type: 'Citrix.MPS.Desktop', launchurl: '/some-launch-id.ica' },
            { name: 'some-desktop-name', type: 'Citrix.MPS.Application', launchurl: 'wrong' },
            { name: 'some-other-name', type: 'Citrix.MPS.Desktop', launchurl: 'wrong' },
          ]
        })

      this.getICAFileContents = this.storeFrontServer.get('/Citrix/StoreWeb/some-launch-id.ica')
        .query({
          CsrfToken: 'some-csrf-token',
          IsUsingHttps: 'Yes',
        })
        .reply(200, fs.readFileSync(path.join(__dirname, 'fixtures', 'example.original.ica'), 'utf-8'))

      this.sut.generateICA((error, icaContents) => {
        if (error) {
          return done(error)
        }
        this.icaContents = icaContents
        done()
      })
    })

    it('should yeild ICA contents', function () {
      const expected = fs.readFileSync(path.join(__dirname, 'fixtures', 'example.modified.ica'), 'utf-8')
      expect(this.icaContents).to.deep.equal(expected.trim())
    })

    it('should call load main page', function () {
      this.loadMainPage.done()
    })

    it('should call home configuration', function () {
      this.homeConfiguration.done()
    })

    it('should check list resources', function () {
      this.checkResources.done()
    })

    it('should call get auth methods', function () {
      this.getAuthMethods.done()
    })

    it('should call explicit login', function () {
      this.explicitLogin.done()
    })

    it('should attempt to login', function () {
      this.explicitLoginAttempt.done()
    })

    it('should really get the resources', function () {
      this.listResources.done()
    })

    it('should get the ica file contents', function() {
      this.getICAFileContents.done()
    })
  })
})
