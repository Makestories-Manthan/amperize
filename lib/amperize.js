"use strict";
var EventEmitter = require("events").EventEmitter,
    emits = require("emits"),
    html = require("htmlparser2"),
    domutils = require("domutils"),
    util = require("util"),
    uuid = require("uuid"),
    async = require("async"),
    url = require("url"),
    _ = require("lodash"),
    helpers = require("./helpers"),
    DEFAULTS = {
        "amp-img": {
            layout: "responsive",
            width: 600,
            height: 400,
        },
        "amp-anim": {
            layout: "responsive",
            width: 600,
            height: 400,
        },
        "amp-iframe": {
            layout: "responsive",
            width: 600,
            height: 400,
            sandbox: "allow-scripts allow-same-origin",
        },
        "amp-youtube": {
            layout: "responsive",
            width: 600,
            height: 400,
        },
        request_timeout: 3000,
    };

/**
 * Amperizer constructor. Borrows from Minimize.
 *
 * https://github.com/Swaagie/minimize/blob/4b815e274a424ca89551d28c4e0dd8b06d9bbdc2/lib/minimize.js#L15
 *
 * @constructor
 * @param {Object} options Options object
 * @api public
 */
function Amperize(options) {
    this.config = _.merge({}, DEFAULTS, options || {});
    this.emits = emits;

    this.htmlParser = new html.Parser(new html.DomHandler(this.emits("read")));
}

util.inherits(Amperize, EventEmitter);

/**
 * Parse the content and call the callback. Borrowed from Minimize.
 *
 * https://github.com/Swaagie/minimize/blob/4b815e274a424ca89551d28c4e0dd8b06d9bbdc2/lib/minimize.js#L51
 *
 * @param {String} content HTML
 * @param {Function} callback
 * @api public
 */
Amperize.prototype.parse = function parse(content, callback) {
    var id;

    if (typeof callback !== "function") {
        throw new Error("No callback provided");
    }

    id = uuid.v4();

    this.once("read", this.amperizer.bind(this, id));
    this.once("parsed: " + id, callback);

    this.htmlParser.parseComplete(content);
};

/**
 * Turn a traversible DOM into string content. Borrowed from Minimize.
 *
 * https://github.com/Swaagie/minimize/blob/4b815e274a424ca89551d28c4e0dd8b06d9bbdc2/lib/minimize.js#L74
 *
 * @param {String} id
 * @param {Object} error
 * @param {Object} dom Traversible DOM object
 * @api private
 */
Amperize.prototype.amperizer = function amperizer(id, error, dom) {
    if (error) {
        throw new Error("Amperizer failed to parse DOM", error);
    }

    this.traverse(dom, "", this.emits("parsed: " + id));
};

/**
 * Reduce the traversible DOM object to a string. Borrows from Minimize.
 *
 * https://github.com/Swaagie/minimize/blob/4b815e274a424ca89551d28c4e0dd8b06d9bbdc2/lib/minimize.js#L90
 *
 * @param {Array} data
 * @param {String} html Compiled HTML contents
 * @param {Function} done Callback function
 * @api private
 */
Amperize.prototype.traverse = async function traverse(data, html, done) {
    var self = this;

    // check if element.width is smaller than 300 px. In that case, we shouldn't use
    // layout="responsive", because the media element will be stretched and it doesn't
    // look nice. Use layout="fixed" instead to fix that.
    function setLayoutAttribute(element) {
        var layout =
            element.attribs.width < 300
                ? (layout = "fixed")
                : self.config[element.name].layout;
        element.attribs.layout = !element.attribs.layout
            ? layout
            : element.attribs.layout;
    }

    // Certain component src attribute must be with 'https' protocol otherwise it will not
    // get validated by AMP. If we're unable to replace it, we will deal with the valitation
    // error, but at least we tried.
    function useSecureSchema(element) {
        if (element.attribs && element.attribs.src) {
            if (element.attribs.src.indexOf("https://") === -1) {
                if (element.attribs.src.indexOf("http://") === 0) {
                    // Replace 'http' with 'https', so the validation passes
                    element.attribs.src = element.attribs.src.replace(
                        /^http:\/\//i,
                        "https://"
                    );
                } else if (element.attribs.src.indexOf("//") === 0) {
                    // Giphy embedded iFrames are without protocol and start with '//', so at least
                    // we can fix those cases.
                    element.attribs.src = "https:" + element.attribs.src;
                }
            }
        }
    }

    // sequentially traverse the DOM
    async.reduce(
        data,
        html,
        function reduce(html, element, step) {
            var children;

            if (/(style|script|textarea|link)/.test(element.name)) {
                return step(null, html);
            }

            function close(error, html) {
                html += helpers.close(element);
                step(null, html);
            }

            function enter() {
                children = element.children;
                html += helpers[element.type](element);

                if (!children || !children.length) {
                    return close(null, html);
                }

                setImmediate(function delay() {
                    traverse.call(self, children, html, close);
                });
            }

            if (element.name === "img") {
                var src = url.parse(element.attribs.src).href;

                // when we have a gif it should be <amp-anim>.
                element.name = src.match(/(\.gif$)/) ? "amp-anim" : "amp-img";
                element.attribs.width = "380";
                element.attribs.height = "280";
                element.attribs.layout = "responsive";
            }

            if (element.name === "iframe") {
                if (!element.attribs.src) {
                    return enter();
                }

                var youtubeId = element.attribs.src.match(
                    /^.*(youtu.be\/|youtube(-nocookie)?.com\/(v\/|.*u\/\w\/|embed\/|.*v=))([\w-]{11}).*/
                );
                useSecureSchema(element);

                if (youtubeId) {
                    element.name = "amp-youtube";
                    element.attribs["data-videoid"] = youtubeId[4];
                    delete element.attribs.src;
                    delete element.attribs.sandbox;
                    delete element.attribs.allowfullscreen;
                    delete element.attribs.allow;
                    delete element.attribs.frameborder;
                } else {
                    element.name = "amp-iframe";
                    element.attribs.sandbox = !element.attribs.sandbox
                        ? self.config["amp-iframe"].sandbox
                        : element.attribs.sandbox;
                }
                element.attribs.width = "380";
                element.attribs.height = "280";
                element.attribs.layout = "responsive";
                setLayoutAttribute(element);

                if (element.attribs.hasOwnProperty("frameborder")) {
                    element.attribs.frameborder =
                        element.attribs.frameborder === "0" ? "0" : "1";
                }

                if (element.attribs.hasOwnProperty("scrolling")) {
                    element.attribs.scrolling =
                        element.attribs.scrolling === "0" ? "0" : "1";
                }

                if (element.attribs.hasOwnProperty("allowfullscreen")) {
                    if (element.attribs.allowfullscreen === "false") {
                        delete element.attribs.allowfullscreen;
                    } else {
                        element.attribs.allowfullscreen = "";
                    }
                }

                if (element.attribs.hasOwnProperty("allowtransparency")) {
                    if (element.attribs.allowtransparency === "false") {
                        delete element.attribs.allowtransparency;
                    } else {
                        element.attribs.allowtransparency = "";
                    }
                }
            }

            if (element.name === "audio") {
                element.name = "amp-audio";
                useSecureSchema(element);
            }
            if (
                element.name === "div" &&
                (element.attribs.class === "fb-video" ||
                    element.attribs.class === "fb-post")
            ) {
                element.name = "amp-facebook";
                delete element.attribs["data-width"];
                delete element.attribs["data-show-text"];
                element.attribs.width = "380";
                element.attribs.height = "280";
                element.attribs.layout = "responsive";
                element.attribs["data-embed-as"] =
                    element.attribs.class === "fb-video" ? "video" : "post";
                element.attribs["data-align-center"] = true;
                element.children = [];
            }
            if (element.name === "blockquote") {
                switch (element.attribs.class) {
                    case "instagram-media":
                        // console.log(element);
                        let key = element.attribs[
                            "data-instgrm-permalink"
                        ].match(/\/p\/(.*?)\//)[1];
                        // console.log(key);
                        element.name = "amp-instagram";
                        delete element.attribs;
                        element.attribs = {};
                        element.attribs["data-shortcode"] = key;
                        element.attribs.width = "380";
                        element.attribs.height = "280";
                        element.attribs.layout = "responsive";
                        element.children = [];
                        break;
                    case "twitter-tweet":
                        const twitterElement = domutils.filter(
                            (ele) =>
                                ele.name == "a" &&
                                ele.attribs.href.match(
                                    /(http|https).*?\/status\/.*?/
                                )
                                    ? true
                                    : false,
                            element,
                            true,
                            1
                        );
                        element.name = "amp-twitter";
                        delete element.attribs;
                        element.attribs = {};
                        element.attribs.width = "380";
                        element.attribs.height = "280";
                        element.attribs.layout = "responsive";
                        element.attribs[
                            "data-tweetid"
                        ] = twitterElement[0].attribs.href.replace(
                            /^https?:\/\/twitter\.com\/(?:#!\/)?(\w+)\/status(es)?\/(\d+).*/,
                            "$3"
                        );
                        element.children = [];
                }
            }

            if (
                element.attribs &&
                element.attribs.src &&
                element.parent &&
                element.parent.name === "amp-audio"
            ) {
                useSecureSchema(element);
            }

            return enter();
        },
        done
    );
};

module.exports = Amperize;
