// original from nai2local.js
//
// ui_tweaks.js
//
// Modify ui parts positions or add button and functions.
// For AUTOMATIC1111's webui, "txt2img".
//
// author: 2022/10/26 bbc_mc


// Functions
//   Add UI Btn and function
//     - for "Positive Prompt"
//       - Clear
//       - History back
//     - for "Negative Prompt"
//       - Clear
//       - History back
//     - for "both"
//       - Clear all
//
// Function of original src
//   Add UI Btn and function
//     - Convert NovelAI type prompt to local type {x} -> (x:1.05)
//

// ========
// Settings
// ========
// 履歴の最大保持数
const MaxHistory = 10;


// ========
// Impl
// ========

// プロンプト履歴
let historyBox = (function () {
  let _historyBox = [];

  return {
    push: function (prompt) {
      if (prompt == _historyBox[_historyBox.length - 1]) return;
      _historyBox.push(prompt);
      if (MaxHistory < _historyBox.length) {
        _historyBox.shift();
      }
    },
    pop: function () {
      let prePrompt = _historyBox.pop();
      return prePrompt;
    },
  };
})();

// Negative prompt history
let historyBox_n = (function () {
  let _historyBox = [];

  return {
    push: function (prompt) {
      if (prompt == _historyBox[_historyBox.length - 1]) return;
      _historyBox.push(prompt);
      if (MaxHistory < _historyBox.length) {
        _historyBox.shift();
      }
    },
    pop: function () {
      let prePrompt = _historyBox.pop();
      return prePrompt;
    },
  };
})();


// NAI-prompt と AUTO1111-prompt 変換 { -> (
// 倍率 1.05
// 小数点以下は 4 桁で丸め
function convert_old(input) {
  let wordArray = [...input];
  let result = [];
  let leftCurlyBracketCount = 0;
  let rightCurlyBracketCount = 0;
  let wordLength = 0;
  for (let i = 0; i < wordArray.length; i++) {
    if (wordArray[i] == "{") {
      leftCurlyBracketCount++;
      if (i == 0) continue;
      if (wordArray[i - 1] != wordArray[i]) {
        result.push(wordArray.slice(i - wordLength, i).join(""));
        wordLength = 0;
      }
      continue;
    }
    if (wordArray[i] == "}") {
      rightCurlyBracketCount++;
      if (rightCurlyBracketCount < leftCurlyBracketCount) continue;

      let word = wordArray
        .slice(i - rightCurlyBracketCount - wordLength + 1, i - rightCurlyBracketCount + 1)
        .join("");
      result.push(`(${word}:${(1.05 ** rightCurlyBracketCount).toFixed(4)})`);
      leftCurlyBracketCount = 0;
      rightCurlyBracketCount = 0;
      wordLength = 0;
      continue;
    }
    wordLength++;
  }
  if (0 < wordLength) {
    result.push(wordArray.slice(wordArray.length - wordLength).join(""));
  }
  return result.join("");
}

// Round function
function round(value) {
  return Math.round(value * 10000) / 10000;
}
function convert(input) {
  const re_attention = /\{|\[|\}|\]|[^\{\}\[\]]+/gmu;
  let text = input.replaceAll("(", "\\(").replaceAll(")", "\\)");

  let res = [];

  let curly_brackets = [];
  let square_brackets = [];

  const curly_bracket_multiplier = 1.05;
  const square_bracket_multiplier = 1 / 1.05;

  function multiply_range(start_position, multiplier) {
    for (let pos = start_position; pos < res.length; pos++) {
      res[pos][1] = round(res[pos][1] * multiplier);
    }
  }

  for (const match of text.matchAll(re_attention)) {
    let word = match[0];

    if (word == "{") {
      curly_brackets.push(res.length);
    } else if (word == "[") {
      square_brackets.push(res.length);
    } else if (word == "}" && curly_brackets.length > 0) {
      multiply_range(curly_brackets.pop(), curly_bracket_multiplier);
    } else if (word == "]" && square_brackets.length > 0) {
      multiply_range(square_brackets.pop(), square_bracket_multiplier);
    } else {
      res.push([word, 1.0]);
    }
  }

  for (const pos of curly_brackets) {
    multiply_range(pos, curly_bracket_multiplier);
  }

  for (const pos of square_brackets) {
    multiply_range(pos, square_bracket_multiplier);
  }

  if (res.length == 0) {
    res = [["", 1.0]];
  }

  // console.log(res);
  // merge runs of identical weights
  let i = 0;
  while (i + 1 < res.length) {
    // console.log("test:" + res[i] + " : " + res[i+1])
    if (res[i][1] == res[i + 1][1]) {
      res[i][0] = res[i][0] + res[i + 1][0];
      // console.log("splicing:" + res[i+1]);
      res.splice(i + 1, 1);
    } else {
      i += 1;
    }
  }
  // console.log(res);

  let result = "";
  for (let i = 0; i < res.length; i++) {
    if (res[i][1] == 1.0) {
      result += res[i][0];
    } else {
      result += "(" + res[i][0] + ":" + res[i][1].toString() + ")";
    }
  }
  return result;
}

//
// Click Event
//

function onClickConvert() {
  let prompt = gradioApp().querySelector("#txt2img_prompt > label > textarea");
  historyBox.push(prompt.value);
  prompt.value = convert(prompt.value);
  prompt.dispatchEvent(new Event("input", { bubbles: true }));
}

function onClickGenerate() {
  let prompt = gradioApp().querySelector("#txt2img_prompt > label > textarea");
  historyBox.push(prompt.value);
}

function onClickUndo_P() {
  let prompt = gradioApp().querySelector("#txt2img_prompt > label > textarea");
  let prePrompt = historyBox.pop();

  if (!prePrompt) return;

  prompt.value = prePrompt;
  prompt.dispatchEvent(new Event("input", { bubbles: true }));
}

function onClickClearPrompt_P() {
  let prompt = gradioApp().querySelector("#txt2img_prompt > label > textarea");
  let prePrompt = historyBox.pop();
  if ( prePrompt == prompt ) {
    console.log("debug: same prompt. push ignored");
    return;
  }
  historyBox.push(prompt.value);
  prompt.value = "";
  prompt.dispatchEvent(new Event("input", { bubbles: true }));
}

function onClickUndo_N() {
  let prompt = gradioApp().querySelector("#txt2img_neg_prompt > label > textarea");
  let prePrompt = historyBox_n.pop();

  if (!prePrompt) return;

  prompt.value = prePrompt;
  prompt.dispatchEvent(new Event("input", { bubbles: true }));
}

function onClickClearPrompt_N() {
  let prompt = gradioApp().querySelector("#txt2img_neg_prompt > label > textarea");
  let prePrompt = historyBox_n.pop();
  if ( prePrompt == prompt ) {
    console.log("debug: same prompt. push ignored");
    return;
  }
  historyBox_n.push(prompt.value);
  prompt.value = "";
  prompt.dispatchEvent(new Event("input", { bubbles: true }));
}

function onClickClearPrompt_All(){
  onClickClearPrompt_P();
  onClickClearPrompt_N();
}

//
// 
//
function addTweaks_txt2img(){
  let parentArea = gradioApp().querySelector("#toprow");
  let generateBtn = gradioApp().querySelector("#txt2img_generate");
  let beforeElement = gradioApp().querySelector("#roll_col");

  if (parentArea == null || generateBtn == null || beforeElement == null) return;
  if (gradioApp().querySelector("#nai2local") != null) return;

  /* 履歴保存のため、generate ボタンにイベント追加 */
  generateBtn.addEventListener("click", onClickGenerate);

  // nai2LocalArea
  let nai2LocalArea = document.createElement("div");
  nai2LocalArea.id = "nai2local";
  nai2LocalArea.className = "overflow-hidden flex flex-col relative col gap-4";
  nai2LocalArea.style = "min-width: min(110px, 100%); max-width: 120px; flex-grow: 1; padding: 0.4em;";

  //
  // Main Tools
  //
  let promptTool_Main = document.createElement("div");
  promptTool_Main.id = "promptTool_Main";
  promptTool_Main.className = "overflow-hidden flex flex-row relative row gap-4";
  promptTool_Main.style = "min-width: unset !important; flex-grow: 0 !important; padding: 0em 0px;";

  // convertBtn Div
  let convertBtn_Div = document.createElement("div");
  convertBtn_Div.className = "flex relative col flex-col";
  convertBtn_Div.style = "min-width:50px;";

  // convertBtn
  let convertBtn = document.createElement("button");
  convertBtn.id = "nai2localconvert";
  convertBtn.type = "button";
  convertBtn.innerHTML = "変換";
  convertBtn.className = "gr-button gr-button-lg gr-button-secondary";
  convertBtn.style = "padding-left: 0.25em; padding-right: 0.25em; margin: 0.1em 0;max-height: 2em; max-width: 3em";
  convertBtn.addEventListener("click", onClickConvert);
  convertBtn_Div.appendChild(convertBtn);

  // ClearAll Btn div
  let clearPrompt_All_Div = document.createElement("div");
  clearPrompt_All_Div.className = "flex relative col flex-col";
  clearPrompt_All_Div.style = "min-width:60px;";

  // ClearAll Btn
  let clearPrompt_All = document.createElement("button");
  clearPrompt_All.id = "promptClearAll";
  clearPrompt_All.type = "button";
  clearPrompt_All.innerHTML = "🗑 All";
  clearPrompt_All.className = "gr-button gr-button-lg gr-button-secondary";
  clearPrompt_All.style = "padding-left: 0.1em; padding-right: 0.25em; margin: 0.1em 0px; max-height: 2em; text-align: left;";
  clearPrompt_All.addEventListener("click", onClickClearPrompt_All);
  clearPrompt_All_Div.appendChild(clearPrompt_All);

  //
  // Positive Prompt
  //
  let promptTool_P = document.createElement("div");
  promptTool_P.id = "promptTool_positive";
  promptTool_P.className = "overflow-hidden flex flex-row relative row gap-4";
  promptTool_P.style = "min-width: unset !important; flex-grow: 0 !important; padding: 0em 0px;";

  // UndoBtn Div
  let undoBtn_P_Div = document.createElement("div");
  undoBtn_P_Div.className = "flex relative col flex-col";
  undoBtn_P_Div.style = "min-width:50px;";

  // UndoBtn
  let undoBtn_P = document.createElement("button");
  undoBtn_P.id = "nai2localUndo";
  undoBtn_P.type = "button";
  undoBtn_P.innerHTML = "←";
  undoBtn_P.className = "gr-button gr-button-lg gr-button-secondary";
  undoBtn_P.style = "padding-left: 0.25em; padding-right: 0.25em; margin: 0.1em 0;max-height: 2em; max-width: 3em";
  undoBtn_P.addEventListener("click", onClickUndo_P);
  undoBtn_P_Div.appendChild(undoBtn_P);

  // ClearPrompt Div
  let clearPrompt_P_Div = document.createElement("div");
  clearPrompt_P_Div.className = "flex relative col flex-col";
  clearPrompt_P_Div.style = "min-width:60px;";

  // ClearPrompt
  let clearPrompt_P = document.createElement("button");
  clearPrompt_P.id = "promptClear";
  clearPrompt_P.type = "button";
  clearPrompt_P.innerHTML = "🗑 Pos";
  clearPrompt_P.className = "gr-button gr-button-lg gr-button-secondary";
  clearPrompt_P.style = "padding-left: 0.1em; padding-right: 0.25em; margin: 0.1em 0px; max-height: 2em; text-align: left;";
  clearPrompt_P.addEventListener("click", onClickClearPrompt_P);
  clearPrompt_P_Div.appendChild(clearPrompt_P);

  //
  // Negative Prompt
  //
  let promptTool_N = document.createElement("div");
  promptTool_N.id = "promptTool_negative";
  promptTool_N.className = "overflow-hidden flex flex-row relative row gap-4";
  promptTool_N.style = "min-width: unset !important; flex-grow: 0 !important; padding: 0em 0px;";

  // UndoBtn_N Div
  let undoBtn_N_Div = document.createElement("div");
  undoBtn_N_Div.className = "flex relative col flex-col";
  undoBtn_N_Div.style = "min-width:50px;";

  // UndoBtn
  let undoBtn_N = document.createElement("button");
  undoBtn_N.id = "nai2localUndo";
  undoBtn_N.type = "button";
  undoBtn_N.innerHTML = "←";
  undoBtn_N.className = "gr-button gr-button-lg gr-button-secondary";
  undoBtn_N.style = "padding-left: 0.25em; padding-right: 0.25em; margin: 0.1em 0;max-height: 2em; max-width: 3em";
  undoBtn_N.addEventListener("click", onClickUndo_N);
  undoBtn_N_Div.appendChild(undoBtn_N);

  // ClearPrompt Div
  let clearPrompt_N_Div = document.createElement("div");
  clearPrompt_N_Div.className = "flex relative col flex-col";
  clearPrompt_N_Div.style = "min-width:60px;";

  // ClearPrompt
  let clearPrompt_N = document.createElement("button");
  clearPrompt_N.id = "promptClear";
  clearPrompt_N.type = "button";
  clearPrompt_N.innerHTML = "🗑 Neg";
  clearPrompt_N.className = "gr-button gr-button-lg gr-button-secondary";
  clearPrompt_N.style = "padding-left: 0.1em; padding-right: 0.25em; margin: 0.1em 0px; max-height: 2em; text-align: left;";
  clearPrompt_N.addEventListener("click", onClickClearPrompt_N);
  clearPrompt_N_Div.appendChild(clearPrompt_N);

  // Joint div and append to actual DOM
  promptTool_Main.appendChild(convertBtn_Div);
  promptTool_Main.appendChild(clearPrompt_All_Div);
  //
  promptTool_P.appendChild(undoBtn_P_Div);
  promptTool_P.appendChild(clearPrompt_P_Div);
  //
  promptTool_N.appendChild(undoBtn_N_Div);
  promptTool_N.appendChild(clearPrompt_N_Div);
  //
  nai2LocalArea.appendChild(promptTool_Main);
  nai2LocalArea.appendChild(promptTool_P);
  nai2LocalArea.appendChild(promptTool_N);

  //
  parentArea.insertBefore(nai2LocalArea, beforeElement.nextSibling);
}


//
// UI
//
onUiUpdate(function () {
  addTweaks_txt2img();
});
