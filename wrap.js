/**
   * 交叉编译注释中的javascript代码块和html块，并渲染dom
   * @param {Object} model 数据，模板中的this指向model
   * @param {Boolean} openLog 是否在控制台打印日志，默认为false
   * @param {Array} replacePlugins 正则表达式替换插件
   * @returns HTMLElement
   */
 Node.prototype._wrap=function(model, openLog, replacePlugins) {

  /*以下模板都是合法的

      1：注释风格
        <!--# for(let item of this){ #--> 
          <div>内容${item}内容</div> 
        <!--# } #-->

      2：属性风格
        <div wrapper="for(let item of this){render();}">
          内容${item}内容
        </div>

      3：去render语法糖
        <div wrapper="for(let item of this){}">
          内容${item}内容
        </div>

      4：去括号语法糖
        <div wrapper="for(let item of this)">
          内容${item}内容
        </div>
  */

  if (!this.innerHTML) return this;

  //定义与注释相关的正则
  const regRender = /\brender\s*\(\s*\)\s*;?/;    //render();的正则
  const regBrackets = /{\s*}/;                    //括号的正则
  const regNeighbor = /#\s*-->\s*<!--\s*#/g;      //两个连续的注释块的连接处
  const regNotesBegin = /<!--\s*#/g;              //注释的开始
  const regNotesEnd = /#\s*-->/g;                 //注释的结束

  //第一步：预编译，将属性风格的js代码块预编译成html注释风格的js代码块 
  const notesNodes = this.querySelectorAll("[wrapper]");
  for (let i = 0; i < notesNodes.length; i++) {
    let element = notesNodes[i];
    let wrapperValue = element.getAttribute("wrapper");
    if (!regRender.test(wrapperValue)) {
      //语法糖处理
      if (regBrackets.test(wrapperValue)) {
        //如果有一对空的大括号，则将其替换成{render();}
        wrapperValue = wrapperValue.replace(regBrackets, "{render();}");
      } else {
        //如果没有一对空的大括号，则直接在末尾处添加{render();}
        wrapperValue = wrapperValue + "{render();}";
      }
    }
    let javascriptCodes = wrapperValue.split(regRender);
    let beginCode = javascriptCodes[0];
    let endCode = javascriptCodes[1];
    element.insertAdjacentHTML("beforebegin", `<!--#${beginCode}#-->`);
    element.insertAdjacentHTML("afterend", `<!--#${endCode}#-->`);
    element.removeAttribute("wrapper");
  }

  //第二步：交叉编译
  let innerHTML = this.innerHTML;
  //将两块毗邻的javascript代码块合并
  innerHTML = innerHTML.replace(regNeighbor, "");
  //开始拼接html
  let dynamicCode = "let _html=`" + innerHTML + "`;";
  //遇到注释的开始标记了，表示上一块html已经拼凑完了，用 `; 结束                  
  dynamicCode = dynamicCode.replace(regNotesBegin, "`;\n");
  //遇到注释的结束标记了，表示其下是一块html代码，用 _html+=` 开始拼凑下一块html    
  dynamicCode = dynamicCode.replace(regNotesEnd, "\n_html+=`");
  //将拼凑好的html代码返回
  dynamicCode = dynamicCode + "return _html;";
  if (openLog) console.log("-----编译结果-----\n", dynamicCode);
  //创建动态函数
  const __fun__ = new Function(dynamicCode);
  //调用call(model),使得模板代码中的this指向model
  innerHTML = __fun__.call(model);

  for (let item of defaultReplacePlugins) {
    innerHTML = innerHTML.replace(item.test, item.value);
  }
  //执行注入的字符串替换插件
  if (replacePlugins) {
    for (let item of replacePlugins) {
      innerHTML = innerHTML.replace(item.test, item.value);
    }
  }

  //第三步：渲染，将html构建成dom树
  this.innerHTML = innerHTML;
  if (openLog) console.log("-----渲染结果-----\n" + innerHTML);

  return this;

}

//默认的字符串替换插件
const defaultReplacePlugins = [
  {
    //html字符串中如果style中有${}则可用_style属性来规避编辑软件的校验
    test: /\b_style\s*=\s*(?='|")/g,
    value: 'style='
  },
  {
    /*处理checked,selected,readonly,disabled四个特殊的属性
        例如：模板中经常这样写：<input type="checkbox" checked="${布尔变量名}" />
        渲染后：<input type="checkbox" checked="false" />
        本意是让复选框不选中，而实际上checked属性等于任何值都会选中。
        因此要做如下处理：
            1：将checked="true"替换成checked="checked"
            2：将checked="false"替换成空
    */
    test: /\bchecked\s*=\s*["']true["']/g,
    value: 'checked="checked"'
  },
  {
    test: /\bchecked\s*=\s*["']false["']/g,
    value: ''
  },
  {
    test: /\bselected\s*=\s*["']true["']/g,
    value: 'selected="selected"'
  },
  {
    test: /\bselected\s*=\s*["']false["']/g,
    value: ''
  },
  {
    test: /\breadonly\s*=\s*["']true["']/g,
    value: 'readonly="readonly"'
  },
  {
    test: /\breadonly\s*=\s*["']false["']/g,
    value: ''
  },
  {
    test: /\bdisabled\s*=\s*["']true["']/g,
    value: 'disabled="disabled"'
  },
  {
    test: /\bdisabled\s*=\s*["']false["']/g,
    value: ''
  }
];