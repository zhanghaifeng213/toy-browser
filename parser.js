let currentToken = null;

function emit(token) {
  if(token.type!="text") {
    console.log(token)
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
    return beforeAttributeName;
  }
}

function selfClosingStartTag(c) {
  if(c==">") {
    currentToken.isSelfClosing =true;
    return data;
  } else if(c == "EOF") {

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