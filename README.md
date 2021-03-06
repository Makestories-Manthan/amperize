# Amperize


[AMP][] up your plain HTML. Replaces regular HTML tags with their equivalent
[AMP components][].

[amp]: https://github.com/ampproject/amphtml
[amp components]: https://github.com/ampproject/amphtml/blob/master/spec/amp-html-components.md

## Installation

`npm install amperize`

## Node.js

```js
var Amperize = require("amperize");

var html = '<img src="https://via.placeholder.com/640x480.jpg" />';

var amperize = new Amperize();

amperize.parse(html, function(error, result) {
  if (error) {
    // do something with error
    return new Error(err);
  }
  // do something with result
  return result;
});
```

## Restrictions

Amperize is build to convert the `<body>` part of your HTML. It will **not**
create the AMP boilerplate and will **not** add the required `<script>` for
each component.

## Currently supported AMP HTML components

### `<amp-img>`

**[`<amp-img>` reference](https://amp.dev/documentation/examples/components/amp-img/)**

Amperize will convert common `<img>` tags into AMP HTML conform `<amp-img>`
tags.

It will fall back to the default values `width: 600` and `height: 400`, if
the dimensions couldn't be fetched.

If any other error occurs (eg. missing `src` property), Amperize will not
transform the tag and return the original.

### `<amp-anim>`

**[`<amp-anim>` reference](https://amp.dev/documentation/examples/components/amp-anim/)**

When the `<img>` tag that needs to be transformed, is a `.gif` animation,
Amperize will convert it into `<amp-anim>`, following the same rules as for
`<amp-img>`.

### `<amp-iframe>`

**[`<amp-iframe>` reference](https://amp.dev/documentation/examples/components/amp-iframe/)**

Amperize converts iFrames like embedded videos from Vimeo, etc. into
`<amp-iframe>` tags. If the `src` attribute is an `http` URL it will be
switched to `https` in order to pass AMP validation.

### `<amp-youtube>`

**[`<amp-youtube>` reference](https://amp.dev/documentation/components/amp-youtube)**

Amperize converts iFrames with a "YouTube" URL into `<amp-youtube>` tags. If
the `src` attribute is an `http` URL it will be switched to `https` in order
to pass AMP validation.

### `<amp-audio>`

**[`<amp-audio>` reference](https://amp.dev/documentation/examples/components/amp-audio/)**

Converts HTML `<audio>` into `<amp-audio>`. If the `src` attribute is an
`http` URL it will be switched to `https` in order to pass AMP validation.

## Development

```bash
git clone git@github.com:Makestories-Manthan/amperize.git
cd amperize
npm install
npm run watch
```

`npm run watch` will restart the tests on changes.

### Tests

Running the test:

`npm run test`

Code coverage:

`npm run coverage`
