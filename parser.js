const css = require("css");

let currentToken = null;
let currentAttribute = null;
let currentTextNode = null;
let stack = [{type:"document", children:[]}]
// 加入一个新的函数，addCSSRules,这里我们把CSS规则暂存到一个数组里
let rules = [];
function addCSSRules(text) {
  var ast = css.parse(text)
  console.log(JSON.stringify(ast, null, "    "))
  rules.push(...ast.stylesheet.rules)
}

function match(element, selector) {
  // element:
  // {
  //   type: 'element',
  //   tagName: 'img',
  //   children: [],
  //   attributes: [ { name: 'isSelfClosing', value: true } ],
  //   computedStyle: {}
  // }
  // selector: 'img'

  if (!selector || !element.attributes) {
    return false;
  }
  if (selector.charAt(0) === '#') {
    const attr = element.attributes.filter(attr => attr.name === 'id')[0];
    if (attr && attr.value === selector.replace('#', '')) {
      return true;
    }
  } else if (selector.charAt(0) === '.') {
    const attr = element.attributes.filter(attr => attr.name === 'class')[0];
    if (attr && typeof attr.value === 'string') {
      // 实现支持空格的class选择器
      const classList = attr.value.split(' ');
      if (classList.includes(selector.replace('.', ''))) {
        return true;
      }
    }
    // if (attr && attr.value === selector.replace('.', '')) {
    //   return true;
    // }
  } else if (element.tagName === selector) {
    return true;
  }
  return false;
}

function specificity(selector) {
  // p[0]: inline
  // p[1]: id
  // p[2]: class
  // p[3]: tagName
  let p = [0, 0, 0, 0];
  const selectorParts = selector.split(' ');
  for (let part of selectorParts) {
    if (part.charAt(0) === '#') {
      p[1] += 1;
    } else if (part.charAt(0) === '.') {
      p[2] += 1;
    } else {
      p[3] += 1;
    }
  }
  return p;
}

function compara(sp1, sp2) {
  if (sp1[0] - sp2[0]) {
    return sp1[0] - sp2[0];
  }
  if (sp1[1] - sp2[1]) {
    return sp1[1] - sp2[1];
  }
  if (sp1[2] - sp2[2]) {
    return sp1[2] - sp2[2];
  }
  return sp1[3] - sp2[3];
}

function computeCSS(element){
  var elements = stack.slice().reverse();

  if (!element.computedStyle) {
    // 给element增加computedStyle属性
    element.computedStyle = {};
  }

  for (let rule of rules) {
    // rule:
    // { type: 'rule',
    //   selectors: [ 'body div img' ],
    //   declarations: [{
    //       type: 'declaration',
    //       property: 'width',
    //       value: '30px',
    //       position: [Object]
    //     }, {
    //       type: 'declaration',
    //       property: 'background-color',
    //       value: '#ff1111',
    //       position: [Object]
    //   }],
    //   position: [Object]
    // }

    const selectorParts = rule.selectors[0].split(' ').reverse(); // reverse的原因是，css选择器是右向左逐个匹配
    if (!match(element, selectorParts[0])) {
      // 不匹配则跳出
      continue;
    }

    let matched = false;
    let j = 1;
    for (let i = 0; i < elements.length; i++) {
      // 逐个匹配
      if (match(elements[i], selectorParts[j])) {
        j++;
      }
    }
    if (j >= selectorParts.length) {
      matched = true;
    }
    if (matched) {
      const sp = specificity(rule.selectors[0]);
      const computedStyle = element.computedStyle;
      for (let declaration of rule.declarations) {
        if (!computedStyle[declaration.property]) {
          computedStyle[declaration.property] = {};
        }
        if (
          !computedStyle[declaration.property].specificity ||
          compara(computedStyle[declaration.property].specificity, sp) < 0
        ) {
          computedStyle[declaration.property].value = declaration.value;
          computedStyle[declaration.property].specificity = sp;
        }
      }
    }
  }
}

function emit(token) {
  // if(token.type=="text") {
  //   return
  // }
  let top = stack[stack.length - 1];
  if (token.type === 'startTag') {
    let element = {
      type: 'element',
      tagName: token.tagName,
      children: [],
      attributes: [],
    };

    for (let p in token) {
      if (p !== 'type' && p !== 'tagName') {
        element.attributes.push({
          name: p,
          value: token[p],
        });
      }
    }

    computeCSS(element)

    top.children.push(element);
    element.parent = top;

    if (!token.isSelfClosing) {
      stack.push(element);
    }
    currentTextNode = null;
  } else if(token.type == "endTag"){
    if (top.tagName !== token.tagName) {
      throw new Error("Tag start end doesn't match!");
    } else {
      // +++++++++++遇到style标签时，执行添加css规则的操作+++++++++++
      if(top.tagName === "style"){
        addCSSRules(top.children[0].content)
      }
      stack.pop();
    }
    currentTextNode = null;
  } else if (token.type == 'text') {
    if (currentTextNode === null) {
      currentTextNode = {
        type: 'text',
        content: "",
      };
      top.children.push(currentTextNode);
    }
    currentTextNode.content += token.content;
  }
  
}

const EOF = Symbol("EOF"); // EOF: End Of File

function data(c) {
  if(c == "<"){
    return tagOpen;
  } else if(c == EOF) {
    emit({type:'EOF'})
    return;
  } else {
    emit({type:'text',content:c})
    return data;
  }
}

function tagOpen(c) {
  if(c == "/") {
    return endTagOpen;
  } else if(c.match(/^[a-zA-Z]$/)) {
    currentToken={
      type: 'startTag',
      tagName: ''
    }
    return tagName(c);
  } else {
    return ;
  }
}

function endTagOpen(c) {
  if(c.match(/^[a-zA-Z]$/)) {
    currentToken = {
      type: "endTag",
      tagName: ""
    }
    return tagName(c)
  } else if(c==">") {

  } else if (c == EOF) {

  } else {

  }
}

function tagName(c) {
  if(c.match(/^[\t\n\f ]$/)) {
    return beforeAttributeName;
  } else if(c=="/") {
    return selfClosingStartTag;
  } else if(c.match(/^[a-zA-Z]$/)) {
    currentToken.tagName+=c//.toLowerCase()
    return tagName;
  } else if(c == ">") {
    emit(currentToken)
    return data;
  } else {
    return tagName;
  }
}

function beforeAttributeName(c) {
  if(c.match(/^[\t\n\f ]$/)) {
    return beforeAttributeName;
  } else if(c == ">") {
    return data;
  } else if(c == "=") {
    return beforeAttributeName;
  } else {
    currentAttribute = {
      name: '',
      value: ''
    }
    return attributeName(c);
  }
}

function attributeName(c) {
  if(c.match(/^[\t\n\f ]$/) || c == "/" || c == ">" || c == EOF){
    return afterAttributeName(c)
  } else if(c == "=") {
    return beforeAttributeValue
  } else if(c == "\u0000"){

  } else if(c=="\"" || c == "'" || c=="<"){

  } else {
    currentAttribute.name+=c;
    return attributeName
  }
}

function beforeAttributeValue(c){
  if(c.match(/^[\t\n\f ]$/) || c == "/" || c == ">" || c == EOF){
    return beforeAttributeValue;
  } else if(c == "\""){
    return doubleQuotedAttributeValue;
  } else if(c == "\'"){
    return singleQuotedAttributeValue;
  } else if(c == ">"){
    // return data
  } else {
    return UnquotedAttributeValue(c)
  }
}

// 第五步 处理属性 加入四个状态
function doubleQuotedAttributeValue(c) {
  if (c === "\"") {
    currentToken[currentAttribute.name] = currentAttribute.value;
    return afterQuotedAttributeValue;
  } else if (c === '\u0000') {

  } else if (c === EOF) {

  } else {
    currentAttribute.value += c;
    return doubleQuotedAttributeValue;
  }
}

function singleQuotedAttributeValue(c) {
  if (c === "\'") {
    currentToken[currentAttribute.name] = currentAttribute.value;
    return afterQuotedAttributeValue;
  } else if (c === '\u0000') {

  } else if (c === EOF) {

  } else {
    currentAttribute.value += c;
    return singleQuotedAttributeValue;
    // return doubleQuotedAttributeValue; // ??
  }
}

function afterQuotedAttributeValue(c) {
  if(c.match(/^[\t\n\f ]$/)) {
    return beforeAttributeName;
  } else if(c == "/") {
    return selfClosingStartTag
  } else if(c==">") {
    currentToken[currentAttribute.name] = currentAttribute.value;
    emit(currentToken)
    return data
  } else if(c == EOF){
    
  } else {
    currentAttribute.value += c;
    return doubleQuotedAttributeValue;
  }
}

function UnquotedAttributeValue(c) {
  if(c.match(/^[\t\n\f ]$/)) {
    currentToken[currentAttribute.name] = currentAttribute.value;
    return beforeAttributeName;
  } else if(c=="/") {
    currentToken[currentAttribute.name] = currentAttribute.value;
    return selfClosingStartTag;
  } else if(c == ">") {
    currentToken[currentAttribute.name] = currentAttribute.value;
    emit(currentToken)
    return data
  } else if(c == "\u0000") {

  } else if(c=="\"" || c=="'" || c == "<" || c == "=" || c =="`") {

  } else if(c == EOF) {

  } else {
    currentAttribute.value += c;
    return UnquotedAttributeValue;
  }
}

function afterAttributeName(c) {
  if (c.match(/^[\t\n\f ]$/)) {
    return afterAttributeName;
  } else if (c === '/') {
    return selfClosingStartTag;
  } else if (c === '=') {
    return beforeAttributeValue;
  } else if (c === '>') {
    currentToken[currentAttribute.name] = currentAttribute.value;
    emit(currentToken);
    return data;
  } else if (c === EOF) {

  } else {
    currentToken[currentAttribute.name] = currentAttribute.value;
    currentAttribute = {
      name: '',
      value: '',
    };
    return attributeName(c);
  }
}

function selfClosingStartTag(c) {
  if (c === '>') {
    currentToken.isSelfClosing = true;
    emit(currentToken);
    return data;
  } else if (c === 'EOF') {

  } else {

  }
}

module.exports.parseHTML = function parseHTML(html) {
  // console.log("html",html);
  let state = data;
  for(let c of html) {
    state = state(c)
  }
  state = state(EOF)
  // console.log(stack[0])
  return stack[0];
};

// parseHTML(`<html maaa=a>
// <head>
// <style>
// body div #myid{
//   width: 100px;
//   background-color: #ff5000;
// }
// body div img{
//   width: 30px;
//   background-color: #ff1111;
// }
// </style>
// </head>
// <body>
//   <div>
//     <img id="#myid"/>
//     <img />
//   </div>
// </body>
// </html>`)