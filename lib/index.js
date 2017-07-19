const fs = require('fs-extra')
const series = require('async/series')
const request = require("request")
const bindAll = require("lodash/fp/bindAll")
const find = require("lodash/fp/find")
const get = require("lodash/fp/get")
const debug = require("debug")("storefront-ica-generator:StoreFrontICAGenerator")

class StoreFrontICAGenerator {
  constructor({ storeFrontUrl, desktop, domain, username, password, icaFilePath }) {
    bindAll(Object.getOwnPropertyNames(StoreFrontICAGenerator.prototype), this)
    if (!storeFrontUrl) throw new Error('StoreFrontICAGenerator: requires storeFrontUrl')
    if (!domain) throw new Error('StoreFrontICAGenerator: requires domain')
    if (!desktop) throw new Error('StoreFrontICAGenerator: requires desktop')
    if (!username) throw new Error('StoreFrontICAGenerator: requires username')
    if (!password) throw new Error('StoreFrontICAGenerator: requires password')
    debug({ storeFrontUrl, desktop, domain, username, password, icaFilePath })
    this.username = username
    this.password = password
    this.domain = domain
    this.desktop = desktop
    this.storeFrontUrl = storeFrontUrl
    this.icaFilePath = icaFilePath
    this.jar = request.jar()
  }

  explicitLogin(callback) {
    this.setStoreFrontCookies()
    const csrfToken = this.getCookie('CsrfToken', 'value')
    const options = {
      baseUrl: this.storeFrontUrl,
      uri: "ExplicitAuth/Login",
      headers: {
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'X-Citrix-IsUsingHTTPS': "Yes",
        'Content-Length': '0',
        'Csrf-Token': csrfToken,
      },
      jar: this.jar,
    }
    debug('explicitLogin', options)
    request.post(options, (error, response) => {
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
      baseUrl: this.storeFrontUrl,
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
      },
      jar: this.jar,
    }
    debug('explicitLoginAttempt', options)
    request.post(options, (error, response) => {
      if (error) return callback(error)
      debug('explicitLoginAttempt result', response.statusCode, response.body, response.headers)
      debug('explicitLoginAttempt cookies', this.getCookies())
      if (response.statusCode > 399) {
        return callback(new Error(`Unexpected status code (${response.statusCode}) when ExplicitAuth/LoginAttempt`))
      }
      callback()
    })
  }

  generateICA(callback) {
    this.getResource((error, foundResource) => {
      if (error) {
        return callback(error)
      }
      this.getICAFileContents(foundResource, callback)
    })
  }

  generateICAFile(callback) {
    this.getResource((error, foundResource) => {
      if (error) {
        return callback(error)
      }
      this.writeICAFileContents(foundResource, callback)
    })
  }

  getAuthMethods(callback) {
    const csrfToken = this.getCookie('CsrfToken', 'value')
    const options = {
      baseUrl: this.storeFrontUrl,
      uri: "Authentication/GetAuthMethods",
      headers: {
        'Accept': 'application/xml, text/xml, */*; q=0.01',
        'X-Citrix-IsUsingHTTPS': "Yes",
        'Content-Length': '0',
        'Csrf-Token': csrfToken,
        'Referer': this.storeFrontUrl,
      },
      jar: this.jar,
    }
    debug('getAuthMethods', options)
    request.post(options, (error, response) => {
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
      baseUrl: this.storeFrontUrl,
      uri: resource.launchurl,
      qs: {
        CsrfToken: csrfToken,
        IsUsingHttps: 'Yes',
      },
      jar: this.jar,
    }
    debug('getICAFileContents', options)
    return request.get(options, (error, response, contents) => {
      if (error) return callback(error)
      debug('getICAFileContents result', response.statusCode, response.body)
      if (response.statusCode > 399) {
        return callback(new Error(`Unexpected status code (${response.statusCode}) when fetching ICA File`))
      }
      callback(null, contents)
    })
  }

  getResource(callback) {
    debug('getResource')
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
      debug('getResource result', result)
      const { listResources } = result
      const resources = get('resources')(listResources)
      const foundResource = find({ name: this.desktop, type: 'Citrix.MPS.Desktop' })(resources)
      if (!foundResource) {
        return callback(new Error('Unable to find resource'))
      }
      callback(null, foundResource)
    })
  }

  homeConfiguration(callback) {
    const options = {
      baseUrl: this.storeFrontUrl,
      uri: "Home/Configuration",
      headers: {
        Accept: 'application/xml, text/xml, */*; q=0.01',
        'Content-Length': 0,
        'X-Requested-With': 'XMLHttpRequest',
        'X-Citrix-IsUsingHTTPS': 'Yes',
        'Referer': this.storeFrontUrl,
      },
      jar: this.jar,
    }
    debug('homeConfiguration', options)
    request.post(options, (error, response) => {
      if (error) return callback(error)
      debug('homeConfiguration result', response.statusCode, response.body)
      if (response.statusCode > 399) {
        return callback(new Error(`Unexpected status code (${response.statusCode}) when fetching Home/Configuration`))
      }
      callback()
    })
  }

  listResources(callback) {
    const csrfToken = this.getCookie('CsrfToken', 'value')
    const options = {
      baseUrl: this.storeFrontUrl,
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
      },
      jar: this.jar,
    }
    debug('listResources', options)
    request.post(options, (error, response, body) => {
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
      baseUrl: this.storeFrontUrl,
      uri: "/",
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Upgrade-Insecure-Requests': '1',
      },
      jar: this.jar,
    }
    debug('loadMainPage', options)
    request.get(options, (error, response) => {
      if (error) return callback(error)
      debug('loadMainPage result', response.statusCode)
      if (response.statusCode > 399) {
        return callback(new Error(`Unexpected status code (${response.statusCode}) when loading /`))
      }
      callback()
    })
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

  writeICAFileContents(resource, callback) {
    if (!this.icaFilePath) return callback(new Error('StoreFrontICAGenerator->writeICAFileContents: requires icaFilePath'))
    this.getICAFileContents(resource, (error, icaContents) => {
      if (error) return callback(error)
      fs.ensureFile(this.icaFilePath, (error) => {
        if (error) return callback(error)
        fs.writeFile(this.icaFilePath, icaContents, callback)
      })
    })
  }
}

module.exports = StoreFrontICAGenerator
