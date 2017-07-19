# storefront-ica-generator

[![Dependency status](http://img.shields.io/david/octoblu/storefront-ica-generator.svg?style=flat)](https://david-dm.org/octoblu/storefront-ica-generator)
[![devDependency Status](http://img.shields.io/david/dev/octoblu/storefront-ica-generator.svg?style=flat)](https://david-dm.org/octoblu/storefront-ica-generator#info=devDependencies)
[![Build Status](http://img.shields.io/travis/octoblu/storefront-ica-generator.svg?style=flat&branch=master)](https://travis-ci.org/octoblu/storefront-ica-generator)
[![Slack Status](http://community-slack.octoblu.com/badge.svg)](http://community-slack.octoblu.com)

[![NPM](https://nodei.co/npm/storefront-ica-generator.svg?style=flat)](https://npmjs.org/package/storefront-ica-generator)

## Usage


```javascript
const StoreFrontICAGenerator = require('storefront-ica-generator')

new StoreFrontICAGenerator({
  username: <username>,
  password: <password>,
  domain: <domain>,
  storeFrontUrl: <storeFrontUrl>,
  desktop: <desktopName>,
}).generateICA((error, contents) => {
  if (error) {
    console.error('Generate ICA Error', error)
    process.exit(1)
    return
  }
  console.log('done', contents)
  process.exit(0)
})
```

```javascript
const StoreFrontICAGenerator = require('storefront-ica-generator')
const icaFilePath = <icaFilePath>

new StoreFrontICAGenerator({
  username: <username>,
  password: <password>,
  domain: <domain>,
  storeFrontUrl: <storeFrontUrl>,
  desktop: <desktopName>,
  icaFilePath: icaFilePath,
}).generateICAFile((error) => {
  if (error) {
    console.error('Generate ICA Error', error)
    process.exit(1)
    return
  }
  console.log('wrote file', icaFilePath)
  process.exit(0)
})
```


## License

The MIT License (MIT)

Copyright 2017 Octoblu Inc.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
