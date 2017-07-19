const StoreFrontService = require('./')
const path = require('path')
const icaFilePath = path.join(process.env.HOME, 'Dropbox', 'Octoblu', 'smartspaces-xendesktop.ica')

new StoreFrontService({
  username: "svcacct_skydyne",
  password: "Citrix2017!",
  // domain: "citrix.com",
  // desktop: "Managed Win10 LAS Desktop",
  // "storeFrontUrl": "https://go.citrite.net/Citrix/StoreWeb/"
  domain: "CITRITE",
  storeFrontUrl: "https://alpha.xendesktop.eng.citrite.net/Citrix/ExternalWeb",
  desktop: "Smart Spaces POC - Early Access Customers",
  icaFilePath: icaFilePath,
}).generateICAFile((error) => {
  if (error) {
    console.error('Generate ICA Error', error)
    process.exit(1)
    return
  }
  console.log('done')
  process.exit(0)
})
