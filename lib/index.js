const child_process = require("child_process")
const debug = require("debug")("storefront-ica-generator:StoreFrontICAGenerator")
const fs = require("fs-extra")
const series = require('async/series')
const request = require("request")
const bindAll = require("lodash/fp/bindAll")
const find = require("lodash/fp/find")
const get = require("lodash/fp/get")
const join = require("lodash/fp/join")
const replace = require("lodash/fp/replace")
const opn = require("opn")
const tmp = require("tmp")
tmp.setGracefulCleanup()

class StoreFrontICAGenerator {
  constructor({ storeFrontUrl, query, domain, username, password }) {
    bindAll(Object.getOwnPropertyNames(StoreFrontICAGenerator.prototype), this)
    if (!storeFrontUrl) throw new Error('StoreFrontICAGenerator: requires storeFrontUrl')
    if (!domain) throw new Error('StoreFrontICAGenerator: requires domain')
    if (!query) throw new Error('StoreFrontICAGenerator: requires query')
    if (!username) throw new Error('StoreFrontICAGenerator: requires username')
    if (!password) throw new Error('StoreFrontICAGenerator: requires password')
    debug({ storeFrontUrl, query, domain, username, password })
    this.username = username
    this.password = password
    this.domain = domain
    this.query = query
    this.storeFrontUrl = storeFrontUrl
    this.jar = request.jar()
    this.request = request.defaults({
      baseUrl: storeFrontUrl,
      jar: this.jar,
      forever: true,
      gzip: true,
      agentOptions: {
        rejectUnauthorized: false
      }
    })
  }

  explicitLogin(callback) {
    this.setStoreFrontCookies()
    const csrfToken = this.getCookie('CsrfToken', 'value')
    const options = {
      uri: "ExplicitAuth/Login",
      headers: {
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'X-Citrix-IsUsingHTTPS': "Yes",
        'Content-Length': '0',
        'Csrf-Token': csrfToken,
      }
    }
    debug('explicitLogin', options)
    this.request.post(options, (error, response) => {
      if (error) return callback(error)
      debug('explicitLogin result', response.statusCode, response.body)
      if (response.statusCode > 399) {
        return callback(new Error(`Unexpected status code (${response.statusCode}) when ExplicitAuth/Login`))
      }
      callback()
    })
  }

  explicitLoginAttempt(callback) {
    const csrfToken = this.getCookie('CsrfToken', 'value')
    const options = {
      uri: "ExplicitAuth/LoginAttempt",
      headers: {
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'Accept-Language': 'en-US,en;q=0.8',
        'X-Requested-With': 'XMLHttpRequest',
        'X-Citrix-IsUsingHTTPS': "Yes",
        'Csrf-Token': csrfToken,
        'Referer': this.storeFrontUrl,
      },
      form: {
        domain: this.domain,
        password: this.password,
        username: this.username,
        saveCredentials: "true",
        loginBtn: 'Log On',
        StateContext: '',
      }
    }
    debug('explicitLoginAttempt', options)
    this.request.post(options, (error, response) => {
      if (error) return callback(error)
      debug('explicitLoginAttempt result', response.statusCode, response.body, response.headers)
      debug('explicitLoginAttempt cookies', this.getCookies())
      if (response.statusCode > 399) {
        return callback(new Error(`Unexpected status code (${response.statusCode}) when ExplicitAuth/LoginAttempt`))
      }
      callback()
    })
  }

  generateAndLaunch(callback) {
    this.generateICAFile((error, icaFilePath) => {
      if (error) {
        return callback(error)
      }
      this.launch(icaFilePath, (error) => {
        if (error) {
          debug('open ica file error', error.stack)
          return callback(new Error('Unable to launch ica file'))
        }
        callback()
      })
    })
  }

  generateICA(callback) {
    this.getResource((error, resource) => {
      if (error) {
        return callback(error)
      }
      this.getICAFileContents(resource, (error, icaContents) => {
        if (error) {
          return callback(error)
        }
        icaContents = this.modifyICA(icaContents)
        debug('modified ica contents', icaContents)
        callback(null, icaContents)
      })
    })
  }

  generateICAFile(callback) {
    tmp.tmpName({ postfix: ".ica" }, (error, icaFilePath) => {
      if (error) return callback(error)
      this.generateICA((error, icaContents) => {
        if (error) {
          return callback(error)
        }
        this.writeICAFileContents(icaFilePath, icaContents, callback)
      })
    })
  }

  getAuthMethods(callback) {
    const csrfToken = this.getCookie('CsrfToken', 'value')
    const options = {
      uri: "Authentication/GetAuthMethods",
      headers: {
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'X-Citrix-IsUsingHTTPS': "Yes",
        'Content-Length': '0',
        'Csrf-Token': csrfToken,
        'Referer': this.storeFrontUrl,
      }
    }
    debug('getAuthMethods', options)
    this.request.post(options, (error, response) => {
      if (error) return callback(error)
      debug('getAuthMethods result', response.statusCode, response.body)
      if (response.statusCode > 399) {
        return callback(new Error(`Unexpected status code (${response.statusCode}) when fetching Authentication/GetAuthMethods`))
      }
      callback()
    })
  }

  getCookies() {
    return this.jar._jar.getCookiesSync(this.storeFrontUrl, { allPaths:true })
  }

  getCookie(key, property) {
    const cookies = this.getCookies()
    const findByKey = find({ key })
    const getProp = get(property)
    debug('found cookie', findByKey(cookies))
    return getProp(findByKey(cookies))
  }

  getICAFileContents(resource, callback) {
    debug('getICAFileContents resource', resource)
    if (!resource.launchurl) {
      return callback(new Error('Resource missing launchurl'))
    }
    const csrfToken = this.getCookie('CsrfToken', 'value')
    const options = {
      uri: resource.launchurl,
      qs: {
        CsrfToken: csrfToken,
        IsUsingHttps: 'Yes',
      }
    }
    debug('getICAFileContents', options)
    this.request.get(options, (error, response, contents) => {
      if (error) return callback(error)
      debug('getICAFileContents result', response.statusCode, response.body)
      if (response.statusCode > 399) {
        return callback(new Error(`Unexpected status code (${response.statusCode}) when fetching ICA File`))
      }
      callback(null, contents)
    })
  }

  getResource(callback) {
    this.getResources((error, resources) => {
      if (error) return callback(error)
      const resource = find(this.query)(resources)
      if (!resource) {
        return callback(new Error('Unable to find resource'))
      }
      callback(null, resource)
    })
  }

  getResources(callback) {
    debug('getResources')
    series({
      loadMainPage: this.loadMainPage,
      homeConfiguration: this.homeConfiguration,
      checkResources: (callback) => {
        this.listResources(() => {
          callback()
        })
      },
      getAuthMethods: this.getAuthMethods,
      explicitLogin: this.explicitLogin,
      explicitLoginAttempt: this.explicitLoginAttempt,
      listResources: this.listResources,
    }, (error, result) => {
      if (error) return callback(error)
      debug('getResources result', result)
      const { listResources } = result
      callback(null, get('resources')(listResources))
    })
  }

  homeConfiguration(callback) {
    const options = {
      uri: "Home/Configuration",
      headers: {
        Accept: 'application/xml, text/xml, */*; q=0.01',
        'Content-Length': 0,
        'X-Requested-With': 'XMLHttpRequest',
        'X-Citrix-IsUsingHTTPS': 'Yes',
        'Referer': this.storeFrontUrl,
      }
    }
    debug('homeConfiguration', options)
    this.request.post(options, (error, response) => {
      if (error) return callback(error)
      debug('homeConfiguration result', response.statusCode, response.body)
      if (response.statusCode > 399) {
        return callback(new Error(`Unexpected status code (${response.statusCode}) when fetching Home/Configuration`))
      }
      callback()
    })
  }

  launch(icaFilePath, callback) {
    debug('launch', process.platform)
    if (process.platform === 'linux') {
      return this.launchOnLinux(icaFilePath, callback)
    }

    opn(icaFilePath).then(() => {
      callback()
    }, callback)
  }

  launchOnLinux(icaFilePath, callback) {
    debug('launchOnLinux')
    const options = { env: { DISPLAY: ':0' } }

    child_process.execFile('/opt/Citrix/ICAClient/wfica', [icaFilePath], options, (error, stdout, stderr) => {
      debug('execFile', stderr, stdout)
      return callback(error)
    })
  }

  listResources(callback) {
    const csrfToken = this.getCookie('CsrfToken', 'value')
    const options = {
      uri: "Resources/List",
      headers: {
        "Accept": 'application/json, text/javascript, */*; q=0.01',
        'X-Citrix-IsUsingHTTPS': "Yes",
        'X-Requested-With': 'XMLHttpRequest',
        'Csrf-Token': csrfToken,
        'Referer': this.storeFrontUrl,
      },
      form: {
        format: 'json',
        resourceDetails: 'Full',
      }
    }
    debug('listResources', options)
    this.request.post(options, (error, response, body) => {
      if (error) return callback(error)
      debug('listResources result', response.statusCode, response.body)
      if (response.statusCode > 399) {
        return callback(new Error(`Unexpected status code (${response.statusCode}) when fetching Resources/List`))
      }
      try {
        callback(null, JSON.parse(body))
      } catch (error) {
        return callback(error)
      }
    })
  }

  loadMainPage(callback) {
    const options = {
      uri: "/",
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
      }
    }
    debug('loadMainPage', options)
    this.request.get(options, (error, response) => {
      if (error) return callback(error)
      debug('loadMainPage result', response.statusCode)
      if (response.statusCode > 399) {
        return callback(new Error(`Unexpected status code (${response.statusCode}) when loading /`))
      }
      callback()
    })
  }

  modifyICA(icaContents) {
    const enableTWIMode = replace('TWIMode=Off', join("\n", ['TWIMode=On', 'TWIIgnoreWorkArea=1']))
    icaContents = this.addSectionToICA('[Thinwire 3.0]', ['TWIFullScreenMode=1'], icaContents)
    icaContents = this.addSectionToICA('[WFClient]', ['TWISeamlessFlag=1'], icaContents)
    return enableTWIMode(icaContents)
  }

  addSectionToICA(title, settings, content) {
    const multiline = join("\n")
    if(content.indexOf(title) < 0) {
      content = multiline([content, title])
    }
    return replace(title, multiline([title, ...settings]))(content)
  }

  setStoreFrontCookies() {
    this.setCookie('CtxsPluginAssistantState', 'Done')
    this.setCookie('CtxsUserPreferredClient', 'Native')
    this.setCookie('CtxsClientDetectionDon', 'true')
    this.setCookie('CtxsHasUpgradeBeenShown', 'true')
  }

  setCookie(key, value) {
    const domain = this.getCookie('CsrfToken', 'domain')
    const cookie = request.cookie(`${key}=${value}; Domain=${domain}`)
    this.jar.setCookie(cookie, this.storeFrontUrl, {ignoreError: true})
  }

  writeICAFileContents(icaFilePath, icaContents, callback) {
    fs.ensureFile(icaFilePath, (error) => {
      if (error) return callback(error)
      fs.writeFile(icaFilePath, icaContents, (error) => {
        if (error) return callback(error)
        callback(null, icaFilePath)
      })
    })
  }

}

module.exports = StoreFrontICAGenerator
