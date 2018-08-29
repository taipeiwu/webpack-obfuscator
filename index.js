"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const JavaScriptObfuscator = require('javascript-obfuscator');
const RawSource = require("webpack-sources").RawSource;
const SourceMapSource = require("webpack-sources").SourceMapSource;
const multimatch = require('multimatch');
const transferSourceMap = require("multi-stage-sourcemap").transfer;
class WebpackObfuscator {
    constructor(options, excludes) {
        this.options = {};
        this.options = options || {};
        this.excludes = this.prepareExcludes(excludes);
    }
    apply(compiler) {
        if (compiler.hooks) {
            compiler.hooks.compilation.tap('WebpackObfuscator', (compilation) => {
                compilation.hooks.optimizeChunkAssets.tap('WebpackObfuscator', (chunks) => {
                    this.obfuscate(compilation, chunks);
                });
            });
        }
        else {
            compiler.plugin('compilation', (compilation) => {
                compilation.plugin("optimize-chunk-assets", (chunks, callback) => {
                    this.obfuscate(compilation, chunks);
                    callback();
                });
            });
        }
    }
    obfuscate(compilation, chunks) {
        let files = [];
        chunks.forEach((chunk) => {
            chunk['files'].forEach((file) => {
                files.push(file);
            });
        });
        compilation.additionalChunkAssets.forEach((file) => {
            files.push(file);
        });
        files.forEach((file) => {
            if (!/\.js($|\?)/i.test(file) || this.shouldExclude(file, this.excludes)) {
                return;
            }
            let asset = compilation.assets[file], input, inputSourceMap;
            if (this.options.sourceMap !== false) {
                if (asset.sourceAndMap) {
                    let sourceAndMap = asset.sourceAndMap();
                    inputSourceMap = sourceAndMap.map;
                    input = sourceAndMap.source;
                }
                else {
                    inputSourceMap = asset.map();
                    input = asset.source();
                }
                if (inputSourceMap) {
                    this.options.sourceMap = true;
                }
            }
            else {
                input = asset.source();
            }
            let obfuscationResult = JavaScriptObfuscator.obfuscate(input, this.options);
            if (this.options.sourceMap) {
                let obfuscationSourceMap = obfuscationResult.getSourceMap(), transferredSourceMap = transferSourceMap({
                    fromSourceMap: obfuscationSourceMap,
                    toSourceMap: inputSourceMap
                });
                compilation.assets[file] = new SourceMapSource(obfuscationResult.toString(), file, JSON.parse(transferredSourceMap), asset.source(), inputSourceMap);
            }
            else {
                compilation.assets[file] = new RawSource(obfuscationResult.toString());
            }
        });
    }
    prepareExcludes(inputExcludes) {
        if (Array.isArray(inputExcludes)) {
            return inputExcludes;
        }
        if (typeof inputExcludes === 'string') {
            return [inputExcludes];
        }
        return [];
    }
    shouldExclude(filePath, excludes) {
        return multimatch(filePath, excludes).length > 0;
    }
}
module.exports = WebpackObfuscator;
