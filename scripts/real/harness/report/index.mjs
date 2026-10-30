/**
 * 报告层统一入口（票 #189）：判定模型、证据六元组、产物采集、Markdown 渲染。
 * 套件/run.mjs 通常只 import 一次本入口或直接 import 具体模块。
 */

export * from './model.mjs';
export * from './artifacts.mjs';
export { MISSING_MARKER, renderMarkdown } from './markdown.mjs';
