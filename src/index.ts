import { v4 } from "uuid";
import { escapeHtml, globalRegExp, sha224Replace, unescapeHtml, urlPas } from "./misc";

interface IDatabase {
  data: { data: string; title: string }[];
}

interface IDocSet {
  docInclude: string;
  docType: "view" | "from" | "thread" | "include";
}
interface IConfig {
  docName: string;
  docType?: "view" | "from" | "thread" | "include";
  useStrike?: "default" | "normal" | "change" | "delete";
  useBold?: "default" | "normal" | "change" | "delete";
  useCategorySet?: "default" | "bottom" | "top";
  useCategoryChangeTitle?: "default" | "off" | "on";
  useFootnoteSet?: "default" | "normal" | "spread" | "popup" | "popover";
  useFootnoteNumber?: "default" | "all" | "only_number";
  useViewRealFootnoteNum?: "default" | "off" | "on";
  useIncludeLink?: "default" | "normal" | "use";
  useImageSet?: "default" | "normal" | "click" | "new_click";
  useTocSet?: "default" | "normal" | "off" | "half_off";
  useExterLink?: "default" | "blank" | "self";
  useLinkDelimiter?: "default" | "normal" | "use";
  useCssDarkmode?: "default" | "0" | "1";
  useTableScroll?: "default" | "off" | "on";
  useTableTransparent?: "default" | "off" | "on";
  useListViewChange?: "default" | "off" | "on";
  useViewJoke?: "default" | "off" | "on";
  useMathScroll?: "default" | "off" | "on";
  useViewHistory?: "default" | "off" | "on";
  useFontSize?: "default" | "10" | "12" | "14" | "16" | "18" | "20" | "22";
  useMonaco?: "default" | "normal" | "use";
}
const skinUseConfig = [
  "useStrike",
  "useBold",
  "useCategorySet",
  "useCategoryChangeTitle",
  "useFootnoteSet",
  "useFootnoteNumber",
  "useViewRealFootnoteNum",
  "useIncludeLink",
  "useImageSet",
  "useTocSet",
  "useExterLink",
  "useLinkDelimiter",
  "useCssDarkmode",
  "useTableScroll",
  "useTableTransparent",
  "useListViewChange",
  "useViewJoke",
  "useMathScroll",
  "useViewHistory",
  "useFontSize",
  "useMonaco",
] as const;

interface IAfterwork {
  type: "folding";
  value: IHeadingFolding;
}
interface IHeadingFolding {
  indentifier: string;
}
export class NamuMark {
  renderData: string = "";

  dataTempStorage: Record<string, string> = {};
  dataTempStorageCount: number = 0;
  dataInclude: string[][] = [];
  dataBacklink: Record<string, any> = {};
  dataMathCount = 0;

  dataToc = "";
  dataFootnoteAll: Record<
    string,
    {
      list: string[];
      data: string;
    }
  > = {};
  dataFootnote: Record<
    string,
    {
      list: string[];
      data: string;
    }
  > = {};
  dataCategory = "";
  dataCategoryList: string[] = [];

  docData: string = "";
  docName: string = "";
  docSet!: IDocSet;
  config!: IConfig;

  renderDataJS = "";
  darkmode = "0";

  database!: IDatabase;

  tempALinkCount!: number;

  doType!: "exter" | "inter";

  linkCount = 0;

  afterwork: IAfterwork[] = [];

  constructor(wikiText: string, config: IConfig, database: IDatabase, doType: "exter" | "inter" = "exter") {
    this.doType = doType;
    this.renderData = wikiText.replace("\r", "");
    if (doType === "exter") {
      this.renderData = escapeHtml(this.renderData);
    }

    this.renderData = "<back_br>\n" + this.renderData + "\n<front_br>";
    this.docSet = { docInclude: v4().replaceAll("-", "") + "_", docType: config.docType || "view" };
    type TOmitted = keyof Omit<Omit<IConfig, "docType">, "docName">;
    for (const key of skinUseConfig) {
      const value = config[key as TOmitted];
      if (!value) {
        config[key as TOmitted] = "default";
      }
    }

    // 기본값으로 설정 (임의적)
    config.useTocSet = "half_off"

    this.config = config;

    this.database = database;
  }

  getToolDataStorage = (dataA = "", dataB = "", dataC = "", doType = "render") => {
    this.dataTempStorageCount += 1;
    let dataName!: string;
    if (doType === "render") {
      dataName = "render_" + this.dataTempStorageCount + this.docSet["docInclude"];
      this.dataTempStorage[dataName] = dataA;
      this.dataTempStorage["/" + dataName] = dataB;
      this.dataTempStorage["revert_" + dataName] = dataC;
    } else {
      dataName = "slash_" + String(this.dataTempStorageCount) + this.docSet["docInclude"];
      this.dataTempStorage[dataName] = dataA;
    }
    return dataName;
  };

  getToolDataRestore = (data: string, doType = "all") => {
    let storageCount = this.dataTempStorageCount * 3;
    const storageRegex =
      doType === "all"
        ? /<(\/?(?:render|slash)_(?:[0-9]+)(?:[^<>]+))>/
        : doType === "render"
        ? /<(\/?(?:render)_(?:[0-9]+)(?:[^<>]+))>/
        : /<(\/?(?:slash)_(?:[0-9]+)(?:[^<>]+))>/;

    while (true) {
      if (!data.match(storageRegex)) break;

      if (storageCount < 0) {
        console.log("Error: render restore count overflow");
        break;
      } else {
        data = data.replace(storageRegex, (match: string, p1: string) => this.dataTempStorage[p1]);
      }

      storageCount -= 1;
    }

    return data;
  };

  getToolDataRevert = (data: string, doType = "all") => {
    let storageCount = this.dataTempStorageCount * 3;
    const storageRegex =
      doType === "all"
        ? /(?:<((slash)_(?:[0-9]+)(?:[^<>]+))>|<((render)_(?:[0-9]+)(?:[^<>]+))>(?:(?:(?!<(?:\/?render_(?:[0-9]+)(?:[^<>]+))>).|\n)*)<\/render_(?:[0-9]+)(?:[^<>]+)>)/
        : doType === "render"
        ? /<((render)_(?:[0-9]+)(?:[^<>]+))>(?:(?:(?!<(?:\/?render_(?:[0-9]+)(?:[^<>]+))>).)*)<\/render_(?:[0-9]+)(?:[^<>]+)>/
        : /<((slash)_(?:[0-9]+)(?:[^<>]+))>/;
    while (true) {
      const match = data.match(storageRegex);
      if (!match) break;
      if (storageCount < 0) {
        console.log("Error: render restore count overflow");
        break;
      } else {
        let matchGroups = match.slice(1);
        let dataRevert!: string;
        if (matchGroups[1] && matchGroups[1] === "render") {
          dataRevert = this.dataTempStorage[`revert_${matchGroups[0]}`] || "";
        } else {
          if (matchGroups.length > 3 && matchGroups[3] === "render") {
            dataRevert = this.dataTempStorage[`revert_${matchGroups[2]}`] || "";
          } else {
            dataRevert = `\\${this.dataTempStorage[matchGroups[0]]}`;
          }
        }

        data = data.replace(storageRegex, dataRevert);
      }
      storageCount -= 1;
    }

    data = data.replace(/<front_br>/g, "");
    data = data.replace(/<back_br>/g, "");

    return data;
  };

  getToolCssSafe = (data: string) => {
    return data.replaceAll(";", "");
  };

  getToolJSSafe = (data: string) => {
    data = data.replaceAll("\n", "\\\\n");
    data = data.replaceAll("\\", "\\\\");
    data = data.replaceAll("'", "\\'");
    data = data.replaceAll('"', '\\"');

    return data;
  };

  getToolDarkModeSplit = (data: string) => {
    const dataNew = data.split(",");
    if (dataNew.length === 1) return dataNew[0];
    else {
      if (this.darkmode === "0") return dataNew[0];
      else return dataNew[1];
    }
  };

  getToolPxAddCheck(data: string) {
    if (data.match(/^[0-9]+$/)) return data + "px";
    else return data;
  }

  getToolFootnoteMake() {
    let data = "";
    for (const forA in this.dataFootnote) {
      if (data === "") {
        data += '<div class="opennamu_footnote">';
      } else {
        data += "<br>";
      }

      if (this.dataFootnote[forA]["list"].length > 1) {
        data += `(${forA}) `;

        for (const forB of this.dataFootnote[forA]["list"]) {
          data +=
            '<sup><a id="' +
            this.docSet["docInclude"] +
            "fn_" +
            forB +
            '" href="#' +
            this.docSet["docInclude"] +
            "rfn_" +
            forB +
            '">(' +
            forB +
            ")</a></sup> ";
        }
      } else {
        data +=
          '<a id="' +
          this.docSet["docInclude"] +
          "fn_" +
          this.dataFootnote[forA]["list"][0] +
          '" href="#' +
          this.docSet["docInclude"] +
          "rfn_" +
          this.dataFootnote[forA]["list"][0] +
          '">(' +
          forA +
          ") </a> ";
      }

      data +=
        '<footnote_title id="' +
        this.docSet["docInclude"] +
        "fn_" +
        this.dataFootnote[forA]["list"][0] +
        '_title">' +
        this.dataFootnote[forA]["data"] +
        "</footnote_title>";
    }

    if (data !== "") {
      data += "</div>";
    }

    this.dataFootnoteAll = { ...this.dataFootnoteAll, ...this.dataFootnote };
    this.dataFootnote = {};
    return data; // 결과 값을 반환합니다.
  }

  getToolLinkFix(linkMain: string, doType = "link") {
    if (doType === "link") {
      if (linkMain === "../") {
        linkMain = this.docName;
        linkMain = linkMain.replace(/(\/[^/]+)$/g, "");
      } else if (linkMain.match(/^\//g)) {
        linkMain = linkMain.replace(/^\//g, this.docName + "/");
      } else if (linkMain.match(/^:(분류|category):/gi)) {
        linkMain = linkMain.replace(/^:(분류|category):/gi, "category:");
      } else if (linkMain.match(/^:(파일|file):/gi)) {
        linkMain = linkMain.replace(/^:(파일|file):/gi, "file:");
      } else if (linkMain.match(/^사용자:/gi)) {
        linkMain = linkMain.replace(/^사용자:/gi, "user:");
      }
    } else {
      // doType === redirect
      if (linkMain === "../") {
        linkMain = this.docName;
        linkMain = linkMain.replace(/(\/[^/]+)$/g, "");
      } else if (linkMain.match(/^분류:/g)) {
        linkMain = linkMain.replace(/^분류:/g, "category:");
      } else if (linkMain.match(/^사용자:/g)) {
        linkMain = linkMain.replace(/^사용자:/g, "user:");
      }
    }

    return linkMain;
  }

  doInterRender(data: string, docInclude: string): string {
    const docSet = { ...this.docSet };
    docSet["docInclude"] = docInclude;

    const dataEnd = new NamuMark(data, { docName: this.docName }, this.database, "inter").parse();
    this.renderDataJS += dataEnd[1];
    this.dataCategoryList.push(...dataEnd[2]["category"]);
    this.dataBacklink = { ...this.dataBacklink, ...dataEnd[2]["backlink_dict"] };
    this.dataTempStorage = { ...this.dataTempStorage, ...dataEnd[2]["temp_storage"][0] };
    this.dataTempStorageCount += dataEnd[2]["temp_storage"][1];
    this.linkCount += dataEnd[2]["link_count"];

    return dataEnd[0];
  }

  manageRemark() {
    this.renderData = this.renderData.replace(/\n##[^\n]+/g, "\n<front_br>");
  }

  manageIncludeDefault() {
    const handler = (match: string, p1: string, p2: string, p3: string) => {
      const matches = [p1, p2, p3]; // 정규 표현식의 그룹들
      if (typeof matches[2] === "number") {
        matches[2] = ""; // 세 번째 그룹이 없을 경우 빈 문자열 추가
      }

      if (matches[2] === "\\") {
        return match; // 원래 문자열 반환
      } else {
        let slashAdd = "";
        if (matches[0]) {
          if (matches[0].length % 2 === 1) {
            slashAdd = "\\".repeat(matches[0].length - 1);
          } else {
            slashAdd = matches[0];
          }
        }

        return slashAdd + matches[2]; // 슬래시 추가 + 세 번째 그룹 반환
      }
    };

    this.renderData = this.renderData.replace(/(\\+)?@([ㄱ-힣a-zA-Z0-9_]+)=((?:\\@|[^@\n])+)@/g, handler);
    this.renderData = this.renderData.replace(/(\\+)?@([ㄱ-힣a-zA-Z0-9_]+)@/g, handler);
  }

  // re.sub fix
  manageInclude() {
    let includeNum = 0;
    const useIncludeLink = this.config.useIncludeLink;
    const includeRegex = /\[include\(((?:(?!\[include\(|\)\]|<\/div>).)+)\)\](\n?)/i;
    let includeCountMax = (this.renderData.match(globalRegExp(includeRegex)) || []).length * 10;
    while (true) {
      includeNum += 1;
      const includeChangeList: Record<string, string> = {};
      let includeMatch = this.renderData.match(includeRegex);
      if (includeCountMax < 0) {
        break;
      } else if (!includeMatch) {
        break;
      }

      if (this.docSet["docType"] === "include") {
        this.renderData = this.renderData.replace(includeRegex, "");
        includeCountMax -= 1;
        continue;
      }

      const matchOrg = includeMatch[0];
      let match = includeMatch.slice(1);

      const macroSplitRegex = /(?:^|,) *([^,]+)/g;
      const macroSplitSubRegex = /^([^=]+) *= *(.*)$/;

      let includeName = "";

      let matches;
      const data = [];

      while ((matches = macroSplitRegex.exec(match[0])) !== null) {
          data.push(matches[1]); // 첫 번째 캡처 그룹을 결과 배열에 추가
      }

      for (const datum of data) {
        const dataSubMatch = datum.match(macroSplitSubRegex);
        if (dataSubMatch) {
          const dataSub = dataSubMatch.slice(1);

          const dataSubName = dataSub[0];
          let dataSubData = this.getToolDataRestore(dataSub[1], "slash");
          dataSubData = escapeHtml(dataSubData);

          dataSubData = dataSubData.replace(/^(?<in>분류|category):/g, ":$<in>:");
          dataSubData = dataSubData.replace(/^(?<in>파일|file):/g, ":$<in>:");

          includeChangeList[dataSubName] = dataSubData;
        } else {
          includeName = datum;
        }
      }

      const includeNameOrg = includeName;
      includeName = this.getToolDataRestore(includeName, "slash");
      includeName = escapeHtml(includeName);

      if (!this.dataBacklink[includeName]) {
        this.dataBacklink[includeName] = {};
      }

      this.dataBacklink[includeName]["include"] = "";

      const result = this.database.data.find((v) => v.title === includeName);
      let dataName!: string;
      if (result) {
        // include link func
        let includeLink = "";
        if (useIncludeLink === "use") {
          includeLink = '<div><a href="/w/' + urlPas(includeName) + '">(' + includeNameOrg + ")</a></div>";
        }

        const includeSubName = this.docSet["docInclude"] + "opennamu_include_" + includeNum;
        this.renderDataJS +=
          'opennamu_do_include("' +
          this.getToolJSSafe(includeName) +
          '", "' +
          this.getToolJSSafe(this.docName) +
          '", "' +
          this.getToolJSSafe(includeSubName) +
          '", "' +
          this.getToolJSSafe(includeSubName) +
          '");\n';

        // api_w_render: route
        //   class api_w_render_include:
        //   def __init__(self, data_option):
        //       self.include_change_list = data_option
      
        //   def __call__(self, match):
        //       match_org = match.group(0)
        //       match = match.groups()
      
        //       if len(match) < 3:
        //           match = list(match) + ['']
      
        //       if match[2] == '\\':
        //           return match_org
        //       else:
        //           slash_add = ''
        //           if match[0]:
        //               if len(match[0]) % 2 == 1:
        //                   slash_add = '\\' * (len(match[0]) - 1)
        //               else:
        //                   slash_add = match[0]
      
        //           if match[1] in self.include_change_list:
        //               return slash_add + self.include_change_list[match[1]]
        //           else:
        //               return slash_add + match[2]

        const handler = () => {
          return (match: string, p1: string, p2: string, p3: string) => {
           const matches = [p1, p2, p3]; // 정규 표현식의 그룹들
           if (typeof matches[2] === "number") {
             matches[2] = ""; // 세 번째 그룹이 없을 경우 빈 문자열 추가
           }
     
           if (matches[2] === "\\") {
             return match; // 원래 문자열 반환
           } else {
             let slashAdd = "";
             if (matches[0]) {
               if (matches[0].length % 2 === 1) {
                 slashAdd = "\\".repeat(matches[0].length - 1);
               } else {
                 slashAdd = matches[0];
               }
             }
     
             if (includeChangeList[matches[1]]) {
              return slashAdd + includeChangeList[matches[1]]
             } else {
               return slashAdd + matches[2]; // 슬래시 추가 + 세 번째 그룹 반환
             }
           }
         };
        }

        // # parameter replace
        result.data = result.data.replace(/(\\+)?@([ㄱ-힣a-zA-Z0-9_]+)=((?:\\@|[^@\n])+)@/g, handler())
        result.data = result.data.replace(/(\\+)?@([ㄱ-힣a-zA-Z0-9_]+)@/g, handler())

        // # remove end br
        result.data = result.data.replace(/^\n+/g, "")

        const mark = (new NamuMark(result.data, { ...this.config, docName: this.docName, docType: "include" }, this.database)).parse()
        dataName = this.getToolDataStorage(
          "" +
            includeLink +
            '<div id="' +
            includeSubName +
            '" style="display: inline;">' +
            mark[0] +
            "</div>" +
            "",
          "",
          matchOrg
        );
      } else {
        this.dataBacklink[includeName]["no"] = "";
        const includeLink = '<div><a class="opennamu_not_exist_link" href="/w/' + urlPas(includeName) + '">(' + includeNameOrg + ")</a></div>";

        dataName = this.getToolDataStorage(includeLink, "", matchOrg);
      }

      this.renderData = this.renderData.replace(includeRegex, "<" + dataName + "></" + dataName + ">" + match[1]);

      includeCountMax -= 1;
    }
  }

  manageSlash() {
    const handler = (match: string, p1: string) => {
      if (p1 === "<") {
        return "<";
      } else {
        const dataName = this.getToolDataStorage(p1, undefined, undefined, "slash");
        return `<${dataName}>`;
      }
    };
    this.renderData = this.renderData.replace(/\\(&lt;|&gt;|&#x27;|&quot;|&amp;|.)/g, handler);
  }

  // re.sub fix
  manageMiddle() {
    let wikiCount = 0;
    let htmlCount = 0;
    let syntaxCount = 0;
    let foldingCount = 0;
    let interCount = 0;
    let interData: Record<string, string> = {};

    const middleRegex = /{{{([^{](?:(?!{{{|}}}).|\n)*)?(?:}|<(\/?(?:slash)_(?:[0-9]+)(?:[^<>]+))>)}}/;
    let middleCountAll = (this.renderData.match(globalRegExp(middleRegex)) || []).length * 10;
    while (true) {
      const middleDataMatch = this.renderData.match(middleRegex);
      if (middleCountAll < 0) break;
      else if (!middleDataMatch) break;

      let middleDataOrg = middleDataMatch[0];
      const middleSlash = middleDataMatch[2];
      if (middleSlash) {
        if (this.dataTempStorage[middleSlash] !== "}") {
          middleDataOrg = middleDataOrg.replace(/<(\/?(?:slash)_(?:[0-9]+)(?:[^<>]+))>/g, "<temp_" + middleSlash + ">");
          this.renderData = this.renderData.replace(middleRegex, middleDataOrg);
          continue;
        }
      }

      let middleData = middleDataMatch[1] || "";
      const middleNameMatch = middleData.match(/^([^ \n]+)/);
      let middleDataPass = "";
      let middleDataAdd = "";
      let dataName = "";

      if (!middleNameMatch) {
        if (middleSlash) {
          middleData += "\\";
        }

        const dataRevert = this.getToolDataRevert(middleData).replace(/^\n/g, "").replace(/\n$/g, "");

        dataName = this.getToolDataStorage(dataRevert, "", middleDataOrg);
        this.renderData = this.renderData.replace(middleRegex, "<" + dataName + ">" + middleDataPass + "</" + dataName + ">" + middleDataAdd);
        middleCountAll -= 1;
        continue;
      }

      const middleName = middleNameMatch[1].toLowerCase();
      if (middleName === "#!wiki") {
        if (middleSlash) {
          middleDataOrg = middleDataOrg.replace(/<(\/?(?:slash)_(?:[0-9]+)(?:[^<>]+))>/g, "<temp_" + middleSlash + ">");
          this.renderData = this.renderData.replace(middleRegex, middleDataOrg);
          continue;
        }

        let wikiData = middleData.replace(/^#!wiki +/g, "");
        const wikiRegex = /^(?:(?:style=(&quot;(?:(?:(?!&quot;).)*)&quot;|&#x27;(?:(?:(?!&#x27;).)*)&#x27;)))(?:\n| +)/i;
        const wikiDarkRegex = /^(?:(?:dark-style=(&quot;(?:(?:(?!&quot;).)*)&quot;|&#x27;(?:(?:(?!&#x27;).)*)&#x27;)))(?:\n| +)/i;
        let wikiDataStyleData = "";

        while (true) {
          let darkOnly = 0;
          let wikiDataStyleMatch = wikiData.match(wikiRegex);
          let wikiDataStyle!: string;
          if (wikiDataStyleMatch) {
            wikiData = wikiData.replace(globalRegExp(wikiRegex), "");
          } else {
            wikiDataStyleMatch = wikiData.match(wikiDarkRegex);
            if (wikiDataStyleMatch) {
              darkOnly = 1;
              wikiData = wikiData.replace(globalRegExp(wikiDarkRegex), "");
            } else {
              break;
            }
          }

          if (wikiDataStyleMatch) {
            wikiDataStyle = wikiDataStyleMatch[1];
            if (wikiDataStyle) {
              wikiDataStyle = wikiDataStyle.replaceAll("&#x27;", "");
              wikiDataStyle = wikiDataStyle.replaceAll("&quot;", "");

              if (darkOnly == 1 && this.darkmode == "1") wikiDataStyleData += wikiDataStyle;
              else if (darkOnly == 0) wikiDataStyleData += wikiDataStyle;
            } else {
              wikiDataStyle = "";
            }
          } else {
            wikiDataStyle = "";
          }
        }

        const findRegex: RegExp[] = [
          / *box-shadow *: *(([^,;]*)(,|;|$)){10,}/,
          / *url\([^()]*\)/,
          / *linear-gradient\((([^(),]+)(,|\))){10,}/,
          / *position *: */,
        ];

        for (const regex of findRegex) {
          if (wikiDataStyleData.match(new RegExp(regex, "i"))) {
            wikiDataStyleData = "";
            break;
          }
        }

        wikiData = this.getToolDataRevert(wikiData).replace(/(^\n|\n$)/g, "");
        interData["inter_data_" + interCount] = wikiData;
        middleDataPass = "<inter_data_" + interCount + ">";
        interCount += 1;

        dataName = this.getToolDataStorage('<div style="' + wikiDataStyleData + '">', "</div>", middleDataOrg);
        wikiCount += 1;
      } else if (middleName === "#!html") {
        let htmlData = middleData.replace(/^#!html( |\n)/g, "");
        if (middleSlash) {
          htmlData += "\\";
        }

        const dataRevert = this.getToolDataRevert(htmlData).replace(/^\n/g, "").replace(/\n$/g, "").replaceAll("&amp;nbsp;", "&nbsp;");

        this.renderDataJS += 'opennamu_do_render_html("' + this.docSet["docInclude"] + "opennamu_wiki_" + htmlCount + '");\n';

        dataName = this.getToolDataStorage(
          '<span id="' + this.docSet["docInclude"] + "opennamu_wiki_" + htmlCount + '">' + dataRevert,
          "</span>",
          middleDataOrg
        );
        htmlCount += 1;
      } else if (middleName === "#!folding") {
        if (middleSlash) {
          middleDataOrg = middleDataOrg.replace(/<(\/?(?:slash)_(?:[0-9]+)(?:[^<>]+))>/g, "<temp_" + middleSlash + ">");
          this.renderData = this.renderData.replace(middleRegex, middleDataOrg);
          continue;
        }

        const wikiRegex = /^#!folding(?: ([^\n]*))?\n/i;
        let wikiDataFoldingMatch = middleData.match(wikiRegex);
        let wikiDataFolding;
        let wikiData = middleData.replace(globalRegExp(wikiRegex), "");
        if (wikiDataFoldingMatch) {
          wikiDataFolding = wikiDataFoldingMatch[1];
          if (!wikiDataFolding) {
            wikiDataFolding = "test";
          }
        } else {
          wikiDataFolding = "test";
        }

        wikiData = this.getToolDataRevert(wikiData).replace(/(^\n|\n$)/g, "");
        interData["inter_data_" + interCount] = wikiData;
        let wikiDataEnd = "<inter_data_" + interCount + ">";
        interCount += 1;

        middleDataPass = wikiDataFolding;
        dataName = this.getToolDataStorage("<details><summary>", '</summary><div class="opennamu_folding">', middleDataOrg);
        const dataName2 = this.getToolDataStorage("", "</div></details>", "");
        middleDataAdd = "<" + dataName2 + ">" + wikiDataEnd + "</" + dataName2 + ">";

        foldingCount += 1;
      } else if (middleName === "#!syntax") {
        if (middleSlash) {
          middleDataOrg = middleDataOrg.replace(/<(\/?(?:slash)_(?:[0-9]+)(?:[^<>]+))>/g, "<temp_" + middleSlash + ">");
          this.renderData = this.renderData.replace(middleRegex, middleDataOrg);
          continue;
        }

        const wikiRegex = /^#!syntax(?: ([^\n]*))?\n/i;
        const wikiDataSyntaxMatch = middleData.match(wikiRegex);
        let wikiDataSyntax;
        let wikiData = middleData.replace(wikiRegex, "");

        if (wikiDataSyntaxMatch) {
          wikiDataSyntax = wikiDataSyntaxMatch[1];
          if (!wikiDataSyntax) {
            wikiDataSyntax = "python";
          } else if (wikiDataSyntax === "asm" || wikiDataSyntax === "assembly") {
            wikiDataSyntax = "x86arm";
          }
        } else {
          wikiDataSyntax = "python";
        }

        if (syntaxCount === 0) {
          this.renderDataJS += `hljs.highlightAll(); hljs.initLineNumbersOnLoad();\n`
        }

        dataName = this.getToolDataStorage('<pre id="syntax"><code class="' + wikiDataSyntax + '">' + wikiData, "</code></pre>", middleDataOrg);
        syntaxCount += 1;

        // 오픈나무 전용 문법 제외: #!dark, #!white
      } else if (["+5", "+4", "+3", "+2", "+1", "-5", "-4", "-3", "-2", "-1"].includes(middleName)) {
        if (middleSlash) {
          middleDataOrg = middleDataOrg.replace(/<(\/?(?:slash)_(?:[0-9]+)(?:[^<>]+))>/g, "<temp_" + middleSlash + ">");
          this.renderData = this.renderData.replace(middleRegex, middleDataOrg);
          continue;
        }

        let wikiData = middleData.replace(/^(\+|\-)[1-5]( |\n)/g, "");
        let wikiSize!: string;
        if (middleName == "+5") wikiSize = "200";
        else if (middleName == "+4") wikiSize = "180";
        else if (middleName == "+3") wikiSize = "160";
        else if (middleName == "+2") wikiSize = "140";
        else if (middleName == "+1") wikiSize = "120";
        else if (middleName == "-5") wikiSize = "50";
        else if (middleName == "-4") wikiSize = "60";
        else if (middleName == "-3") wikiSize = "70";
        else if (middleName == "-2") wikiSize = "80";
        else wikiSize = "90";

        middleDataPass = wikiData;
        dataName = this.getToolDataStorage('<span style="font-size:' + wikiSize + '%">', "</span>", middleDataOrg);
      } else if (middleName.match(/^@(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+))/)) {
        if (middleSlash) {
          middleDataOrg = middleDataOrg.replace(/<(\/?(?:slash)_(?:[0-9]+)(?:[^<>]+))>/g, "<temp_" + middleSlash + ">");
          this.renderData = this.renderData.replace(middleRegex, middleDataOrg);
          continue;
        }

        const wikiColorMatch = middleName.match(/^@(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+))(,@(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+)))?/);
        let wikiColorData = "";
        if (wikiColorMatch) {
          if (wikiColorMatch[1]) {
            wikiColorData += "#" + wikiColorMatch[1];
          } else {
            wikiColorData += wikiColorMatch[2];
          }

          if (wikiColorMatch[3]) {
            if (wikiColorMatch[4]) {
              wikiColorData += ",#" + wikiColorMatch[4];
            } else if (wikiColorMatch[5]) {
              wikiColorData += "," + wikiColorMatch[5];
            }
          }
        } else {
          wikiColorData += "red";
        }

        let wikiColor = this.getToolCssSafe(wikiColorData);
        wikiColor = this.getToolDarkModeSplit(wikiColor);

        const wikiData = middleData.replace(/^@(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+))(?:,@(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+)))?( |\n)/g, "");

        middleDataPass = wikiData;
        dataName = this.getToolDataStorage('<span style="background-color:' + wikiColor + '">', "</span>", middleDataOrg);
      } else if (middleName.match(/^#(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+))/)) {
        if (middleSlash) {
          middleDataOrg = middleDataOrg.replace(/<(\/?(?:slash)_(?:[0-9]+)(?:[^<>]+))>/g, "<temp_" + middleSlash + ">");
          this.renderData = this.renderData.replace(middleRegex, middleDataOrg);
          continue;
        }

        const wikiColorMatch = middleName.match(/^#(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+))(,#(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+)))?/);
        let wikiColorData = "";
        if (wikiColorMatch) {
          if (wikiColorMatch[1]) {
            wikiColorData += "#" + wikiColorMatch[1];
          } else {
            wikiColorData += wikiColorMatch[2];
          }

          if (wikiColorMatch[3]) {
            if (wikiColorMatch[4]) {
              wikiColorData += ",#" + wikiColorMatch[4];
            } else if (wikiColorMatch[5]) {
              wikiColorData += "," + wikiColorMatch[5];
            }
          }
        } else {
          wikiColorData += "red";
        }

        let wikiColor = this.getToolCssSafe(wikiColorData);
        wikiColor = this.getToolDarkModeSplit(wikiColor);

        const wikiData = middleData.replace(/^#(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+))(?:,#(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+)))?( |\n)/g, "");

        middleDataPass = wikiData;
        dataName = this.getToolDataStorage('<span style="color:' + wikiColor + '">', "</span>", middleDataOrg);
      } else {
        if (middleSlash) {
          middleData += "\\";
        }

        const dataRevert = this.getToolDataRevert(middleData).replace(/^\n/g, "").replace(/\n$/g, "");
        dataName = this.getToolDataStorage(dataRevert, "", middleDataOrg);
      }

      this.renderData = this.renderData.replace(middleRegex, "<" + dataName + ">" + middleDataPass + "</" + dataName + ">" + middleDataAdd);
      middleCountAll -= 1;
    }
    const interDataRegex = /<(inter_data_[0-9]+)>/g;
    const replaceInterData = () => {
      const replaceSub = (match: string, ...groups: string[]) => {
        let data = interData[groups[0]];
        data = data.replace(interDataRegex, replaceSub);

        return data;
      };

      return (match: string, ...groups: string[]) => {
        let data = interData[groups[0]];
        data = data.replace(interDataRegex, replaceSub);

        data = this.doInterRender(data, this.docSet["docInclude"] + "opennamu_inter_render_" + interCount);
        interCount += 1;

        return data;
      };
    };

    this.renderData = this.renderData
      .replace(interDataRegex, replaceInterData())
      .replace(/'<temp_(?<in>(?:slash)_(?:[0-9]+)(?:[^<>]+))>/g, "<$<in>>");
  }

  // re.sub fix
  manageMath() {
    const handler: (match: string, p1: string) => string = (match, p1) => {
      let data = p1;
      data = this.getToolDataRevert(data.replace(/\n/g, ""));
      let dataHTML = this.getToolJSSafe(data);

      data = unescapeHtml(data);
      data = this.getToolJSSafe(data);

      let nameOb = this.docSet["docInclude"] + "opennamu_math_" + this.dataMathCount;
      let dataName = this.getToolDataStorage('<span id="' + nameOb + '">' + dataHTML, "</span>", match);

      this.renderDataJS += `
try {
  katex.render("${data}", document.getElementById("${nameOb}"));
} catch {
  if (document.getElementById("${nameOb}")) {
      document.getElementById("${nameOb}").innerHTML = "<span style='color: red;'>${dataHTML}</span>";
  }
}
      `;
      this.dataMathCount += 1;
      return `<${dataName}></${dataName}>`;
    };

    const mathRegex = /\[math\(((?:(?!\[math\(|\)\]).|\n)+)\)\]/gi;
    const mathRegex2 = /&lt;math&gt;((?:(?!&lt;math&gt;|&lt;\/math&gt;).)+)&lt;\/math&gt;/gi;
    this.renderData = this.renderData.replace(mathRegex2, handler);
    this.renderData = this.renderData.replace(mathRegex, handler);
  }

  // re.sub fix
  manageTable() {
    this.renderData = this.renderData.replace(/\n +\|\|/g, "\n||");

    const manageTableParameter = (cellCount: string, parameter: string, data: string) => {
      const tableParameterAll = { div: "", class: "", table: "", tr: "", td: "", col: "", colspan: "", rowspan: "", data: "" };

      let tableAlignAuto = 1;
      let tableColspanAuto = 1;
      let doAnyThing = "";

      const tableParameterRegex = /&lt;((?:(?!&lt;|&gt;).)+)&gt;/;
      const tableParameterRegexGlobal = /&lt;((?:(?!&lt;|&gt;).)+)&gt;/g;
      let match;
      let tableParameterResults = [];
      while ((match = tableParameterRegexGlobal.exec(parameter)) !== null) {
        tableParameterResults.push(match);
      }
      tableParameterResults.forEach((array) => array.splice(0, 1));
      tableParameterResults = tableParameterResults.flat();

      for (const tableParameter of tableParameterResults) {
        const tableParameterSplit = tableParameter.split("=");
        let tableParameterData!: string;
        if (tableParameterSplit.length === 2) {
          const tableParameterName = tableParameterSplit[0].replace(" ", "").toLowerCase();
          tableParameterData = this.getToolCssSafe(tableParameterSplit[1]);

          if (tableParameterName == "tablebgcolor") tableParameterAll["table"] += "background:" + this.getToolDarkModeSplit(tableParameterData) + ";";
          else if (tableParameterName == "tablewidth") {
            tableParameterAll["div"] += "width:" + this.getToolPxAddCheck(tableParameterData) + ";";
            tableParameterAll["table"] += "width:100%;";
          } else if (tableParameterName == "tableheight") tableParameterAll["table"] += "height:" + this.getToolPxAddCheck(tableParameterData) + ";";
          else if (tableParameterName == "tablealign") {
            if (tableParameterData == "right") tableParameterAll["div"] += "float:right;";
            else if (tableParameterData == "center") {
              tableParameterAll["div"] += "margin:auto;";
              tableParameterAll["table"] += "margin:auto;";
            }
          } else if (tableParameterName == "tableclass") tableParameterAll["class"] = tableParameterSplit[1];
          else if (tableParameterName == "tabletextalign") tableParameterAll["table"] += "text-align:" + tableParameterData + " !important;";
          else if (tableParameterName == "tablecolor") tableParameterAll["table"] += "color:" + this.getToolDarkModeSplit(tableParameterData) + ";";
          else if (tableParameterName == "tablebordercolor")
            tableParameterAll["table"] += "border:2px solid " + this.getToolDarkModeSplit(tableParameterData) + ";";
          else if (tableParameterName == "rowbgcolor") tableParameterAll["tr"] += "background:" + this.getToolDarkModeSplit(tableParameterData) + ";";
          else if (tableParameterName == "rowtextalign") tableParameterAll["tr"] += "text-align:" + tableParameterData + " !important;";
          else if (tableParameterName == "rowcolor") tableParameterAll["tr"] += "color:" + this.getToolDarkModeSplit(tableParameterData) + ";";
          else if (tableParameterName == "colcolor") tableParameterAll["col"] += "color:" + this.getToolDarkModeSplit(tableParameterData) + ";";
          else if (tableParameterName == "colbgcolor")
            tableParameterAll["col"] += "background:" + this.getToolDarkModeSplit(tableParameterData) + ";";
          else if (tableParameterName == "coltextalign") tableParameterAll["col"] += "text-align:" + tableParameterData + " !important;";
          else if (tableParameterName == "bgcolor") tableParameterAll["td"] += "background:" + this.getToolDarkModeSplit(tableParameterData) + ";";
          else if (tableParameterName == "color") tableParameterAll["td"] += "color:" + this.getToolDarkModeSplit(tableParameterData) + ";";
          else if (tableParameterName == "width") tableParameterAll["td"] += "width:" + this.getToolPxAddCheck(tableParameterData) + ";";
          else if (tableParameterName == "height") tableParameterAll["td"] += "height:" + this.getToolPxAddCheck(tableParameterData) + ";";
          else doAnyThing += "&lt;" + tableParameter + "&gt;";
        } else if (tableParameterSplit.length === 1) {
          if (tableParameter == "nopad") tableParameterAll["td"] += "padding: 0 !important;";
          else if (tableParameter.match(/^-[0-9]+$/)) {
            tableColspanAuto = 0;
            tableParameterAll["colspan"] = tableParameter.replace(/[^0-9]+/g, "");
          } else if (tableParameter.match(/^(\^|v)?\|[0-9]+$/)) {
            if (tableParameter[0] == "^") tableParameterAll["td"] += "vertical-align: top;";
            else if (tableParameter[0] == "v") tableParameterAll["td"] += "vertical-align: bottom;";

            tableParameterAll["rowspan"] = tableParameter.replace(/[^0-9]+/g, "");
          } else if (["(", ":", ")"].includes(tableParameter)) {
            tableAlignAuto = 0;
            if (tableParameter == "(") tableParameterAll["td"] += "text-align: left !important;";
            else if (tableParameter == ":") tableParameterAll["td"] += "text-align: center !important;";
            else if (tableParameter == ")") tableParameterAll["td"] += "text-align: right !important;";
          } else if (tableParameter.match(/^(?:(?:#((?:[0-9a-f-A-F]{3}){1,2}))|(\w+))$/)) {
            tableParameterData = this.getToolCssSafe(tableParameter);
            tableParameterAll["td"] += "background:" + this.getToolDarkModeSplit(tableParameterData) + ";";
          } else {
            doAnyThing += "&lt;" + tableParameter + "&gt;";
          }
        } else {
          doAnyThing += "&lt;" + tableParameter + "&gt;";
        }
      }

      if (tableAlignAuto === 1) {
        if (data.match(/^ /)) {
          data = data.replace(/^ /g, "");
          if (data.match(/ $/)) {
            tableParameterAll["td"] += "text-align: center;";
            data = data.replace(/ $/g, "");
          } else {
            tableParameterAll["td"] += "text-align: right;";
          }
        } else {
          tableParameterAll["td"] += "text-align: left;";
          if (data.match(/ $/)) {
            data = data.replace(/ $/, "");
          }
        }
      }

      if (tableColspanAuto === 1) {
        tableParameterAll["colspan"] = "" + Math.floor(cellCount.length / 2);
      }

      tableParameterAll["data"] = doAnyThing + data;
      return tableParameterAll;
    };

    const tableRegex =
      /\n((?:(?:(?:(?:\|\|)+)|(?:\|[^|]+\|(?:\|\|)*))\n?(?:(?:(?!\|\|).)+))(?:(?:\|\||\|\|\n|(?:\|\|)+(?!\n)(?:(?:(?!\|\|).)+)\n*)*)\|\|)\n/s;
    const tableSubRegex = /(\n?)((?:\|\|)+)((?:&lt;(?:(?:(?!&lt;|&gt;).)+)&gt;)*)((?:\n*(?:(?:(?:(?!\|\|).)+)\n*)+)|(?:(?:(?!\|\|).)*))/;
    const tableCaptionRegex = /^\|([^|]+)\|/;
    let tableCountAll = (this.renderData.match(globalRegExp(tableRegex)) || []).length * 2;
    while (true) {
      const tableDataMatch = this.renderData.match(tableRegex);
      if (tableCountAll < 0) {
        console.error("error: render table count overflow");
        break;
      } else if (!tableDataMatch) break;

      let tableData = tableDataMatch[1];
      const tableCaptionMatch = tableData.match(tableCaptionRegex);
      let tableCaption!: string;
      if (tableCaptionMatch) {
        tableCaption = `<caption>${tableCaptionMatch[1]}</caption>`;
        tableData = tableData.replace(globalRegExp(tableCaptionRegex), "||");
      } else {
        tableCaption = "";
      }

      const tableParameter: {
        div: string;
        class: string;
        table: string;
        tr: string;
        td: string;
        col: Record<number, string>;
        rowspan: Record<number, number>;
      } = { div: "", class: "", table: "", tr: "", td: "", col: {}, rowspan: {} };
      let tableDataEnd = "";
      let tableColNum = 0;
      let tableTrChange = 0;

      let match;
      let tableSubResults = [];
      const tableSubRegexGlobal = globalRegExp(tableSubRegex);
      while ((match = tableSubRegexGlobal.exec(tableData)) !== null) {
        tableSubResults.push(match);
      }
      // 0번 그룹 제거
      tableSubResults.forEach((array) => array.splice(0, 1));
      for (const tableSub of tableSubResults) {
        let tableDataIn = tableSub[3];
        tableDataIn = tableDataIn.replace(/^\n+/g, "");

        if (tableSub[0] !== "" && tableTrChange === 1) {
          tableColNum = 0;
          tableDataEnd += '<tr style="' + tableParameter["tr"] + '">' + tableParameter["td"] + "</tr>";
          tableParameter["tr"] = "";
          tableParameter["td"] = "";
        }

        let tableSubParameter = manageTableParameter(tableSub[1], tableSub[2], tableDataIn);
        tableParameter["tr"] += tableSubParameter["tr"];

        if (!tableParameter["rowspan"][tableColNum]) {
          tableParameter["rowspan"][tableColNum] = 0;
        } else {
          if (tableParameter["rowspan"][tableColNum] !== 0) {
            tableParameter["rowspan"][tableColNum] -= 1;
            tableColNum += 1;
          }
        }

        if (tableSubParameter["rowspan"] !== "") {
          const rowspanInt = Number(tableSubParameter["rowspan"]);
          if (rowspanInt > 1) {
            tableParameter["rowspan"][tableColNum] = rowspanInt - 1;
          }
        }

        if (!tableParameter["col"][tableColNum]) {
          tableParameter["col"][tableColNum] = "";
        }

        tableParameter["div"] += tableSubParameter["div"];
        tableParameter["class"] = tableSubParameter["class"] !== "" ? tableSubParameter["class"] : tableParameter["class"];
        tableParameter["table"] += tableSubParameter["table"];
        tableParameter["col"][tableColNum] += tableSubParameter["col"];

        if (tableSub[2] === "" && tableSub[3] === "") {
          tableTrChange = 1;
        } else {
          tableTrChange = 0;
          tableParameter["td"] +=
            '<td colspan="' +
            tableSubParameter["colspan"] +
            '" rowspan="' +
            tableSubParameter["rowspan"] +
            '" style="' +
            tableParameter["col"][tableColNum] +
            tableSubParameter["td"] +
            '"><back_br>\n' +
            tableSubParameter["data"] +
            "\n<front_br></td>";
        }

        tableColNum += 1;
      }

      tableDataEnd += '<tr style="' + tableParameter["tr"] + '">' + tableParameter["td"] + "</tr>";
      tableDataEnd =
        '<table class="' + tableParameter["class"] + '" style="' + tableParameter["table"] + '">' + tableCaption + tableDataEnd + "</table>";
      tableDataEnd = '<div class="table_safe" style="' + tableParameter["div"] + '">' + tableDataEnd + "</div>";
      this.renderData = this.renderData.replace(tableRegex, "\n<front_br>" + tableDataEnd + "\n");

      tableCountAll -= 1;
    }
  }

  manageList() {
    const quoteRegex = /((?:\n&gt; *[^\n]*)+)\n/;
    let quoteCount = 0;
    let quoteCountMax = (this.renderData.match(globalRegExp(quoteRegex)) || []).length * 10;
    while (true) {
      let quoteDataMatch = this.renderData.match(quoteRegex);
      if (quoteCountMax < 0) break;
      else if (!quoteDataMatch) break;
      else {
        const quoteDataOrg = quoteDataMatch[0];
        let quoteData = quoteDataMatch[1];
        quoteData = quoteData.replace(/\n&gt; *(?<in>[^\n]*)/g, "$<in>\n").replace(/\n$/g, "");
        quoteData = this.getToolDataRevert(quoteData);

        let quoteDataEnd = this.doInterRender(quoteData, this.docSet["docInclude"] + "opennamu_quote_" + quoteCount);
        const dataName = this.getToolDataStorage("<div>", "</div>", quoteDataOrg);

        this.renderData = this.renderData.replace(
          quoteRegex,
          "\n<blockquote><back_br>\n<" + dataName + ">" + quoteDataEnd + "</" + dataName + "><front_br></blockquote>\n"
        );
      }

      quoteCountMax -= 1;
      quoteCount += 1;
    }

    function intToAlpha(num: number) {
      const alphaList = Array.from(Array(26), (_, i) => String.fromCharCode(97 + i)).join("");
      const alphaLen = alphaList.length;
      let end_text = "";

      while (num) {
        end_text = alphaList[(num % alphaLen) - 1] + end_text;
        num = Math.floor(num / alphaLen);
      }

      return end_text;
    }

    // https://www.geeksforgeeks.org/python-program-to-convert-integer-to-roman/
    function intToRoman(number: number) {
      const num = [1, 4, 5, 9, 10, 40, 50, 90, 100, 400, 500, 900, 1000];
      const sym = ["I", "IV", "V", "IX", "X", "XL", "L", "XC", "C", "CD", "D", "CM", "M"];
      let i = 12;
      let end_text = "";

      while (number) {
        let div = Math.floor(number / num[i]);
        number %= num[i];

        while (div) {
          end_text += sym[i];
          div -= 1;
        }

        i -= 1;
      }

      return end_text;
    }

    const useListViewChange = this.config.useListViewChange;
    const listStyle: Record<number, string> = {
      1: "opennamu_list_1",
      2: "opennamu_list_2",
      3: "opennamu_list_3",
      4: "opennamu_list_4",
    };

    const intToMatch = () => {
      const listNum: Record<string, number[]> = {};
      return (match: string, ...groups: string[]) => {
        if (groups[3]) {
          let listData = groups[4];
          let listLen = groups[0].length;
          if (listLen === 0) {
            listLen = 1;
          }

          let listStyleData = "opennamu_list_5";
          if (listStyle[listLen]) {
            listStyleData = listStyle[listLen];
          }
          return '<li style="margin-left: ' + listLen * 20 + 'px;" class="' + listStyleData + '">' + listData + "</li>";
        } else {
          let listType = groups[1];

          let doType = "int";
          if (listType == "a") doType = "alpha_small";
          else if (listType == "A") doType = "alpha_big";
          else if (listType == "i") doType = "roman_small";
          else if (listType == "I") doType = "roman_big";

          if (!listNum[doType]) listNum[doType] = [];

          for (const type of Object.keys(listNum)) {
            if (type !== doType) listNum[type] = [];
          }

          let listData = groups[4];
          let listStart = groups[2];
          let listLen = groups[0].length;
          if (listLen === 0) {
            listLen = 1;
          }

          if (listNum[doType].length >= listLen) {
            listNum[doType][listLen - 1] += 1;
            for (let i = listLen; i < listNum[doType].length; i++) {
              listNum[doType][i] = 0;
            }
          } else {
            listNum[doType] = listNum[doType].concat(
              "1"
                .repeat(listLen - listNum[doType].length)
                .split("")
                .map((v) => Number(v))
            );
          }

          if (listStart) {
            listNum[doType][listLen - 1] = Number(listStart);
          }

          let changeText!: string;
          if (doType == "int") {
            if (useListViewChange === "on") {
              changeText = listNum[doType]
                .filter((value: number) => value !== 0)
                .map((value: number) => String(value))
                .join("-");
            } else {
              changeText = String(listNum[doType][listLen - 1]);
            }
          } else if (doType == "roman_big") changeText = intToRoman(listNum[doType][listLen - 1]).toUpperCase();
          else if (doType == "roman_small") changeText = intToRoman(listNum[doType][listLen - 1]).toLowerCase();
          else if (doType == "alpha_big") changeText = intToAlpha(listNum[doType][listLen - 1]).toUpperCase();
          else changeText = intToAlpha(listNum[doType][listLen - 1]).toLowerCase();

          return '<li style="margin-left: ' + (listLen - 1) * 20 + 'px;" class="opennamu_list_none">' + changeText + ". " + listData + "</li>";
        }
      };
    };

    const listRegex = /((?:\n( *)(?:(\*)) ?([^\n]*))+|(?:\n( *)(?:(1|a|A|I|i)\.(?:#([0-9]*))?) ?([^\n]*)){2,})\n/;
    let listCountMax = (this.renderData.match(globalRegExp(listRegex)) || []).length * 3;
    while (true) {
      const listDataMatch = this.renderData.match(listRegex);
      if (listCountMax < 0) break;
      else if (!listDataMatch) break;
      else {
        const listData = listDataMatch[1];
        const listSubRegex = /\n( *)(?:(1|a|A|I|i)\.(?:#([0-9]*))?|(\*)) ?([^\n]*)/g;
        const listDataStr = listData.replace(listSubRegex, intToMatch());

        this.renderData = this.renderData.replace(listRegex, "\n<front_br><ul>" + listDataStr + "</ul><back_br>\n");
      }

      listCountMax -= 1;
    }
  }

  // re.sub fix
  manageMacro() {
    // double macro function
    const manageMacroDouble = (full: string, ...match: string[]) => {
      const matchOriginal = full;
      
      const nameData = match[0].toLowerCase();

      const macroSplitRegex = /(?:^|,) *([^,]+)/;
      const macroSplitSubRegex = /(^[^=]+) *= *([^=]+)/;

      if (['youtube', 'nicovideo', 'navertv', 'kakaotv', 'vimeo', 'instagram', 'twitter', 'tiktok', 'facebook'].includes(nameData)) {
        const data = match[1].match(globalRegExp(macroSplitRegex)) || [];

        // get option
        let videoCode = "";
        let videoStart = "";
        let videoEnd = "";

        let videoWidth = "640px";
        let videoHeight = "360px";
        if (nameData == 'instagram' || nameData == 'tiktok') {
          videoWidth = '360px'
          videoHeight = '480px'
        }
        else if (nameData == 'facebook') {
          videoWidth = '500px'
          videoHeight = '616px'
        }
        else if (nameData == 'twitter') {
          videoWidth = '480px'
          videoHeight = '480px'
        }

        for (const datum of data) {
          const dataSubMatch = datum.match(macroSplitSubRegex);
          if (dataSubMatch) {
            let dataSub = dataSubMatch.slice(1)
            dataSub = [dataSub[0].toLowerCase(), dataSub[1]];

            if (dataSub[0] === "width") videoWidth = this.getToolPxAddCheck(dataSub[1]);
            else if (dataSub[0] === "height") videoHeight = this.getToolPxAddCheck(dataSub[1]);
            else if (dataSub[0] === "start") videoStart = dataSub[1];
            else if (dataSub[0] === "end") videoEnd = dataSub[1];
            else if (dataSub[0] === "https://www.youtube.com/watch?v" && nameData == "youtube") videoCode = dataSub[1];
          } else {
            videoCode = datum;
          }
        }

        // code to url
        if (nameData === "youtube") {
          videoCode = videoCode.replace(/^https:\/\/youtu\.be\//g, "");
          videoCode = `https://www.youtube.com/embed/${videoCode}`;

          if (videoStart !== "") {
            if (videoEnd !== "") {
              videoCode += "?start=" + videoStart + "&end=" + videoEnd;
            } else {
              videoCode += "?start=" + videoStart;
            }
          } else {
            if (videoEnd !== "") {
              videoCode += "?end=" + videoEnd;
            }
          }
        } 
    else if (nameData === 'instagram') {
        videoCode = videoCode.replace(/^https:\/\/www\.instagram\.com\/p\//g, '')
        videoCode = 'https://www.instagram.com/p/' + videoCode +'/embed/'
    } else if (nameData === 'facebook') {
        videoCode = 'https://www.facebook.com/plugins/post.php?href=' + videoCode + '&width=' + videoWidth + '&height=' + videoHeight
    } else if (nameData === 'tiktok') {
        videoCode = 'https://www.tiktok.com/embed/v2/' + videoCode
    } else if (nameData === 'twitter') {
        videoCode = 'https://twitframe.com/show?url=' + videoCode
        if (this.darkmode === '1')
            videoCode += '&theme=dark'
    } else if (nameData === "kakaotv") {
          videoCode = videoCode.replace(/^https:\/\/tv\.kakao\.com\/v\//g, "");
          videoCode = `https://tv.kakao.com/embed/player/cliplink/${videoCode}?service=kakao_tv`;
        } else if (nameData === "navertv") {
          videoCode = videoCode.replace(/^https:\/\/tv\.naver\.com\/v\//g, "");
          videoCode = `https://tv.naver.com/embed/${videoCode}`;
        } else if (nameData === "nicovideo") {
          videoCode = `https://embed.nicovideo.jp/watch/${videoCode}`;
        } else {
          videoCode = `https://player.vimeo.com/video/${videoCode}`;
        }

        videoWidth = this.getToolCssSafe(videoWidth);
        videoHeight = this.getToolCssSafe(videoHeight);
        const dataName = this.getToolDataStorage(
          '<iframe style="width: ' + videoWidth + "; height: " + videoHeight + ';" src="' + videoCode + '" frameborder="0" allowfullscreen>',
          "</iframe>",
          matchOriginal
        );

        return "<" + dataName + "></" + dataName + ">";
      } else if (nameData === "toc") {
        return "<toc_no_auto>";
      } else if (nameData === "ruby") {
        const data = match[1].match(globalRegExp(macroSplitRegex)) || [];

        // get option
        let mainText = "";
        let subText = "";
        let color = "";
        for (const datum of data) {
          const dataSubMatch = datum.match(macroSplitSubRegex);

          if (dataSubMatch) {
            let dataSub = dataSubMatch.slice(1);
            dataSub = [dataSub[0].toLowerCase(), dataSub[1]];

            if (dataSub[0] === "ruby") subText = dataSub[1];
            else if (dataSub[0] === "color") color = dataSub[1];
          } else {
            mainText = datum;
          }
        }

        mainText = this.getToolDataRevert(mainText, "render");
        subText = this.getToolDataRevert(subText, "render");
        color = this.getToolCssSafe(color);

        // add color
        if (color !== "") {
          subText = '<span style="color:' + color + ';">' + subText + "</span>";
        }

        const dataName = this.getToolDataStorage("<ruby>" + mainText + "<rp>(</rp><rt>" + subText + "</rt><rp>)</rp></ruby>", "", matchOriginal);

        return "<" + dataName + "></" + dataName + ">";
      } else if (nameData === "anchor") {
        const mainText = this.getToolDataRevert(match[1], "render");
        const dataName = this.getToolDataStorage('<span id="' + mainText + '">', "</span>", matchOriginal);
        return "<" + dataName + "></" + dataName + ">";
      } else if (nameData === "age") {
        // 정규 표현식으로 날짜 형식 검사
        let dataText = "";
        const datePattern = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

        if (datePattern.test(match[1])) {
          const date = new Date(match[1]);
          const dateNow = new Date();

          // 유효성 검사
          if (!isNaN(date.getTime())) {
            // 날짜가 유효한 경우
            if (date > dateNow) {
              dataText = "invalid date";
            } else {
              const diffInYears = Math.floor((dateNow.valueOf() - date.valueOf()) / (1000 * 60 * 60 * 24 * 365));
              dataText = diffInYears.toString();
            }
          } else {
            dataText = "invalid date";
          }
        } else {
          dataText = "invalid date";
        }

        const dataName = this.getToolDataStorage(dataText, "", matchOriginal);

        // 결과 반환
        return `<${dataName}></${dataName}>`;
      } else if (nameData === "dday") {
        let dataText = "";

        // 정규 표현식으로 날짜 형식 검사
        const datePattern = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

        if (datePattern.test(match[1])) {
          const date = new Date(match[1]);
          const dateNow = new Date();

          // 유효성 검사
          if (!isNaN(date.getTime())) {
            // 날짜가 유효한 경우
            const dateEnd = Math.floor((dateNow.valueOf() - date.valueOf()) / (1000 * 60 * 60 * 24)); // 일수 계산

            if (dateEnd > 0) {
              dataText = "+" + dateEnd;
            } else if (dateEnd === 0) {
              dataText = "-" + dateEnd;
            } else {
              dataText = dateEnd.toString();
            }
          } else {
            dataText = "invalid date";
          }
        } else {
          dataText = "invalid date";
        }

        const dataName = this.getToolDataStorage(dataText, "", matchOriginal);

        // 결과 반환
        return `<${dataName}></${dataName}>`;
      } else if (nameData === "pagecount") {
        return "0";
      } else {
        return "<macro>" + match[0] + "(" + match[1] + ")" + "</macro>";
      }
    };

    this.renderData = this.renderData.replace(/\[([^[(\]]+)\(((?:(?!\)\]).)+)\)\]/g, manageMacroDouble);

    const manageMacroSingle = (full: string, p1: string) => {
      const matchOriginal = full;
      let match = p1.toLowerCase();

      if (["date", "datetime"].includes(match)) {
        const getTime = () => {
          const date = new Date();
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, "0"); // 월은 0부터 시작하므로 1을 더합니다.
          const day = String(date.getDate()).padStart(2, "0");
          const hours = String(date.getHours()).padStart(2, "0");
          const minutes = String(date.getMinutes()).padStart(2, "0");
          const seconds = String(date.getSeconds()).padStart(2, "0");

          return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
        };
        const dataName = this.getToolDataStorage(getTime(), "", matchOriginal);
        return "<" + dataName + "></" + dataName + ">";
      } else if (match === "br") {
        const dataName = this.getToolDataStorage("<br>", "", matchOriginal);
        return "<" + dataName + "></" + dataName + ">";
      } else if (match === "clearfix") {
        const dataName = this.getToolDataStorage('<div style="clear: both;"></div>', "", matchOriginal);
        return "<" + dataName + "></" + dataName + ">";
      } else if (["목차", "toc", "tableofcontents"].includes(match)) {
        return "<toc_need_part>";
      } else if (match === "pagecount") {
        return String((this.database.data || []).length);
      } else {
        return `<macro>${p1}</macro>`;
      }
    };

    // single macro replace
    this.renderData = this.renderData.replace(/\[([^[\]]+)\]/g, manageMacroSingle);

    // macro safe restore
    this.renderData = this.renderData.replaceAll("<macro>", "[");
    this.renderData = this.renderData.replaceAll("</macro>", "]");
  }

  // re.sub fix
  manageLink() {
    this.renderData = this.renderData.replaceAll("[[]]", "");

    const linkRegex = /\[\[((?:(?!\[\[|\]\]|\||<|>).|<(?:\/?(?:slash)_(?:[0-9]+)(?:[^<>]+))>)+)(?:\|((?:(?!\[\[|\]\]|\|).)+))?\]\](\n?)/;
    let imageCount = 0;

    let linkCountAll = (this.renderData.match(globalRegExp(linkRegex)) || []).length * 4;
    while (true) {
      const linkDataMatch = this.renderData.match(linkRegex);
      if (!linkDataMatch) break;
      else if (linkCountAll < 0) {
        console.log("Error: render link count overflow");
        break;
      }

      // link split
      const linkDataFull = linkDataMatch[0];
      let linkData = linkDataMatch.slice(1);

      let linkMain = linkData[0];
      let linkMainOrg = linkMain;

      // file link
      if (linkMain.match(/^(파일|file|외부|out):/i)) {
        let fileWidth = "";
        let fileHeight = "";
        let fileAlign = "";
        let fileBgcolor = "";
        let fileTurn = "";
        let fileRadius = "";
        let fileRendering = "";

        const fileSplitRegex = /(?:^|&amp;) *((?:(?!&amp;).)+)/g;
        const fileSplitSubRegex = /(^[^=]+) *= *([^=]+)/;

        if (linkData[1]) {
          const data = linkData[1].match(fileSplitRegex) || [];

          for (const datum of data) {
            const dataSub = datum.match(fileSplitSubRegex);
            if (dataSub) {
              const key = dataSub[1].trim();
              const value = dataSub[2].trim();

              switch (key) {
                case "width":
                  fileWidth = this.getToolPxAddCheck(value);
                  break;
                case "height":
                  fileHeight = this.getToolPxAddCheck(value);
                  break;
                case "align":
                  if (["center", "left", "right"].includes(value)) {
                    fileAlign = value;
                  }
                  break;
                case "bgcolor":
                  fileBgcolor = value;
                  break;
                case "theme":
                  if (value === "dark") {
                    fileTurn = "dark";
                  } else if (value === "light") {
                    fileTurn = "light";
                  }
                  break;
                case "border-radius":
                  fileRadius = this.getToolPxAddCheck(value);
                  break;
                case "rendering":
                  if (value === "pixelated") {
                    fileRendering = "pixelated";
                  }
                  break;
                default:
                  break;
              }
            }
          }
        }

        linkMainOrg = "";
        let linkSub = linkMain;
        let fileOut = 0;

        let linkExist!: string;
        let linkExtension!: string;

        const linkOutRegex = /^(외부|out):/i;
        const linkInRegex = /^(파일|file):/i;

        // 링크 아웃 체크
        if (linkOutRegex.test(linkMain)) {
          linkMain = linkMain.replace(new RegExp(linkOutRegex, "gi"), "");

          linkMain = this.getToolDataRestore(linkMain, "slash");
          linkMain = unescapeHtml(linkMain); // HTML Unescape
          linkMain = linkMain.replace(/"/g, "&quot;");

          linkExist = "";
          fileOut = 1;
        } else {
          linkMain = linkMain.replace(new RegExp(linkInRegex, "gi"), "");

          linkMain = this.getToolDataRestore(linkMain, "slash");
          linkMain = unescapeHtml(linkMain);

          if (!this.dataBacklink[`file:${linkMain}`]) {
            this.dataBacklink[`file:${linkMain}`] = {};
          }

          const dbData = this.database.data.find((value) => value.title === `file:${linkMain}`)?.title;
          if (dbData) {
            linkExist = "";
          } else {
            linkExist = "opennamu_not_exist_link";
            this.dataBacklink[`file:${linkMain}`]["no"] = "";
          }

          // 미구현: v.3.5.0 rev
          const rev = "1";
          this.dataBacklink[`file:${linkMain}`]["file"] = "";

          const linkExtensionRegex = /\.([^.]+)$/;
          const linkExtensionMatch = linkMain.match(linkExtensionRegex);
          if (linkExtensionMatch) {
            linkExtension = linkExtensionMatch[1];
          } else {
            linkExtension = "jpg";
          }

          linkMain = linkMain.replace(new RegExp(linkExtensionRegex, "g"), "");
          linkMainOrg = linkMain;

          linkMain = "/image/" + urlPas(sha224Replace(linkMain)) + "." + linkExtension + ".cache_v" + rev;
        }

        // 스타일 설정
        if (fileWidth !== "") {
          fileWidth = "width:" + this.getToolCssSafe(fileWidth) + ";";
        }

        if (fileHeight !== "") {
          fileHeight = "height:" + this.getToolCssSafe(fileHeight) + ";";
        }

        let fileAlignStyle = "";
        if (["left", "right"].includes(fileAlign)) {
          fileAlignStyle = "float:" + fileAlign + ";";
        }

        if (fileBgcolor !== "") {
          fileBgcolor = "background:" + this.getToolCssSafe(fileBgcolor) + ";";
        }

        if (fileRadius !== "") fileRadius = "border-radius:" + this.getToolCssSafe(fileRadius) + ";";

        if (fileRendering != "") fileRendering = "image-rendering:" + this.getToolCssSafe(fileRendering) + ";";

        const fileStyle = fileWidth + fileHeight + fileAlignStyle + fileBgcolor + fileRadius + fileRendering;
        let fileEnd!: string;
        const useImageSet = this.config.useImageSet;
        if (useImageSet == "new_click" || useImageSet == "click") {
          fileEnd = '<img style="' + fileStyle + '" id="opennamu_image_' + imageCount + '" alt="' + linkSub + '" src="">';
        } else {
          fileEnd = '<img style="' + fileStyle + '" alt="' + linkSub + '" src="' + linkMain + '">';
        }

        if (fileAlign === "center") {
          fileEnd = `<div style="text-align:center;">${fileEnd}</div>`;
        }

        // 링크 존재 여부에 따른 처리
        if (linkExist !== "") {
          const dataName = this.getToolDataStorage(
            `<a class="${linkExist}" title="${linkSub}" href="/upload?name=${urlPas(linkMainOrg)}">(${linkSub})</a>`,
            "</a>",
            linkDataFull
          );
          this.renderData = this.renderData.replace(linkRegex, `<${dataName}></${dataName}>`);
        } else {
          let filePass = 0;
          if (fileTurn !== "") {
            if (fileTurn === "dark" && this.darkmode === "1") {
              filePass = 1;
            } else if (fileTurn === "light" && this.darkmode === "0") {
              filePass = 1;
            }
          } else {
            filePass = 1;
          }

          let fileLink!: string;
          let dataName!: string;
          if (filePass === 1) {
            if (fileOut === 0) {
              fileLink = "/w/file:" + urlPas(linkMainOrg) + "." + urlPas(linkExtension);
            } else {
              fileLink = linkMain;
            }

            if (useImageSet === "new_click") {
              dataName = this.getToolDataStorage(
                '<a title="' + linkSub + '" id="opennamu_image_' + imageCount + '_link" href="javascript:void(0);">' + fileEnd,
                "</a>",
                linkDataFull
              );
              this.renderDataJS +=
                'document.getElementById("opennamu_image_' +
                imageCount +
                '_link").addEventListener("click", function(e) { document.getElementById("opennamu_image_' +
                imageCount +
                '").src = "' +
                this.getToolJSSafe(linkMain) +
                '";setTimeout(function() {document.getElementById("opennamu_image_' +
                imageCount +
                '_link").href = "' +
                this.getToolJSSafe(fileLink) +
                '";}, 100);});\n';
              imageCount += 1;
            } else {
              dataName = this.getToolDataStorage('<a title="' + linkSub + '" href="' + fileLink + '">' + fileEnd, "</a>", linkDataFull);
            }
          } else {
            dataName = this.getToolDataStorage("", "", linkDataFull);
          }

          this.renderData = this.renderData.replace(linkRegex, `<${dataName}></${dataName}>` + linkData[2]);
        }
      }
      // category 처리
      else if (/^(분류|category):/i.test(linkMain)) {
        linkMain = linkMain.replace(/^(분류|category):/gi, "");

        let categoryBlur = "";
        if (/#blur$/i.test(linkMain)) {
          linkMain = linkMain.replace(/#blur$/gi, "");
          categoryBlur = "opennamu_category_blur";
        }

        let linkSub = linkMain;
        let linkView = "";
        if (linkData.length > 1 && linkData[1]) linkView = linkData[1];

        linkMain = this.getToolDataRestore(linkMain, "slash");
        linkMain = unescapeHtml(linkMain);

        if (!this.dataCategoryList.includes(linkMain)) {
          this.dataCategoryList.push(linkMain);

          if (!this.dataBacklink["category:" + linkMain]) this.dataBacklink["category:" + linkMain] = {};

          const dbData = this.database.data.find((value) => value.title === "category:" + linkMain)?.title;
          let linkExist!: string;
          if (dbData) {
            linkExist = "";
          } else {
            linkExist = "opennamu_not_exist_link";
            this.dataBacklink["category:" + linkMain]["no"] = "";
          }

          this.dataBacklink["category:" + linkMain]["cat"] = "";

          if (linkView != "") this.dataBacklink["category:" + linkMain]["cat_view"] = linkView;

          if (categoryBlur != "") this.dataBacklink["category:" + linkMain]["cat_blur"] = "";

          linkMain = urlPas(linkMain);

          if (this.dataCategory === "") {
            this.dataCategory =
              '<div class="opennamu_category" id="cate">' +
              '<a class="opennamu_category_button" href="javascript:opennamu_do_category_spread();"> (+)</a>' +
              "카테고리" +
              " : ";
          } else {
            this.dataCategory += " | ";
          }

          this.dataCategory += `<a class="${categoryBlur} ${linkExist}" title="${linkSub}" href="/w/category:${linkMain}">${linkSub}</a>`;
        }

        this.renderData = this.renderData.replace(linkRegex, "");
      }
      // inter link 처리 (미구현/오픈나무 전용 문법)
      else if (/^(?:inter|인터):([^:]+):/i.test(linkMain)) {
        const linkInterRegex = /^(?:inter|인터):([^:]+):/i;

        const linkInterNameMatch = linkMain.match(linkInterRegex) || [];
        let linkInterName: string = linkInterNameMatch ? linkInterNameMatch[1] : "";

        linkMain = linkMain.replace(new RegExp(linkInterRegex, "g"), "");
        const linkTitle = `${linkInterName}:${linkMain}`;

        linkMain = linkMain.replace(/&#x27;/g, "<link_single>");
        const linkDataSharpRegex = /#([^#]+)$/;
        let linkDataSharpMatch = linkMain.match(linkDataSharpRegex) || [];
        let linkDataSharp!: string;
        if (linkDataSharpMatch.length === 0) {
          linkDataSharp = linkDataSharpMatch[1];
          linkDataSharp = unescapeHtml(linkDataSharp);
          linkDataSharp = "#" + urlPas(linkDataSharp);
          linkMain = linkMain.replace(new RegExp(linkDataSharpRegex, "g"), "");
        } else {
          linkDataSharp = "";
        }

        linkMain = linkMain.replaceAll("<link_single>", "&#x27;");

        // main link fix
        linkMain = this.getToolDataRestore(linkMain, "slash");
        linkMain = unescapeHtml(linkMain);
        linkMain = urlPas(linkMain);

        // 미구현: 인터위키
        this.renderData = this.renderData.replace(linkRegex, linkData[2]);
      }
      // out link 처리
      else if (/^https?:\/\//i.test(linkMain)) {
        linkMain = this.getToolDataRestore(linkMain, "slash");
        const linkTitle = linkMain;
        linkMain = unescapeHtml(linkMain);

        linkMain = linkMain.replace(/"/g, "&quot;");
        linkMain = linkMain.replace(/</g, "&lt;");
        linkMain = linkMain.replace(/>/g, "&gt;");

        // sub not exist -> sub = main
        let linkSub = linkData[1] || "";
        const linkSubStorage = linkSub ? "" : linkMainOrg;

        const linkClass = "opennamu_link_out";
        // 미구현: 인터위키

        const addStr = linkData[2] || "";

        const dataName = this.getToolDataStorage(
          `<a class="${linkClass}" target="_blank" title="${linkTitle}" href="${linkMain}">${linkSubStorage}`,
          "</a>",
          linkDataFull
        );
        this.renderData = this.renderData.replace(linkRegex, `<${dataName}>${linkSub}</${dataName}>` + addStr);
      }
      // in link 처리
      else {
        // under page & fix url
        linkMain = this.getToolLinkFix(linkMain);

        // sharp
        linkMain = linkMain.replace(/&#x27;/g, "<link_single>");
        const linkDataSharpRegex = /#([^#]+)$/;
        let linkDataSharpMatch = linkMain.match(linkDataSharpRegex) || [];
        let linkDataSharp!: string;
        if (linkDataSharpMatch.length !== 0) {
          linkDataSharp = linkDataSharpMatch[1];
          linkDataSharp = unescapeHtml(linkDataSharp);
          linkDataSharp = "#" + urlPas(linkDataSharp);

          linkMain = linkMain.replace(new RegExp(linkDataSharpRegex, "g"), "");
        } else {
          linkDataSharp = "";
        }

        linkMain = linkMain.replaceAll("<link_single>", "&#x27;");

        // main link fix
        linkMain = this.getToolDataRestore(linkMain, "slash");
        linkMain = unescapeHtml(linkMain);

        // link title
        const linkTitle = escapeHtml(linkMain + linkDataSharp);
        let linkExist = "";
        if (linkMain !== "") {
          // 미구현: self.link_case_insensitive
          const dbData = this.database.data.find((value) => value.title === linkMain)?.title;
          if (!dbData) {
            if (!this.dataBacklink[linkMain]) {
              this.dataBacklink[linkMain] = {};
            }
            this.dataBacklink[linkMain]["no"] = "";
            linkExist = "opennamu_not_exist_link";
          } else {
            if (!this.dataBacklink[linkMain]) {
              this.dataBacklink[linkMain] = {};
            }
          }
          this.dataBacklink[linkMain][""] = "";
        }

        let linkSame = "";
        if (linkMain === this.docName) {
          linkSame = "opennamu_same_link";
        }

        linkMain = urlPas(linkMain);

        if (linkMain !== "") {
          linkMain = "/w/" + linkMain;
        }

        // sub not exist
        let linkSub = linkData[1] || "";
        const linkSubStorage = linkSub ? "" : linkMainOrg;

        this.linkCount += 1;

        const addStr = linkData[2] || "";
        const dataName = this.getToolDataStorage(
          `<a class="${linkExist} ${linkSame}" title="${linkTitle}" href="${linkMain}${linkDataSharp}">${linkSubStorage}`,
          "</a>",
          linkDataFull
        );
        this.renderData = this.renderData.replace(linkRegex, `<${dataName}>${linkSub}</${dataName}>` + addStr);
      }

      linkCountAll -= 1;
    }
  }

  // re.sub fix
  manageFootnote() {
    let footnoteNum = 0;

    const useFootnoteSet = this.config.useFootnoteSet;
    const useFootnoteNumber = this.config.useFootnoteNumber;
    const useViewRealFootnoteNum = this.config.useViewRealFootnoteNum;

    const footnoteRegex = /(?:\[\*((?:(?!\[\*|\]| ).)+)?(?: ((?:(?!\[\*|\]).)+))?\]|\[(각주|footnote)\])/i;
    let footnoteCountAll = (this.renderData.match(globalRegExp(footnoteRegex)) || []).length * 4;

    while (true) {
      footnoteNum += 1;

      const footnoteData = footnoteRegex.exec(this.renderData);
      if (footnoteCountAll < 0) {
        break;
      } else if (!footnoteData) {
        break;
      } else {
        const footnoteDataOriginal = footnoteData[0];
        const footnoteDataGroups = footnoteData.slice(1);

        if (footnoteDataGroups[2]) {
          this.renderData = this.renderData.replace(footnoteRegex, () => this.getToolFootnoteMake());
        } else {
          const footnoteNumStr = String(footnoteNum);

          let footnoteName = footnoteDataGroups[0] || footnoteNumStr;
          const footnoteNameAdd = footnoteDataGroups[0] ? ` (${footnoteNumStr})` : "";
          const footnoteTextData = footnoteDataGroups[1] || "";

          let fn = "";
          let rfn = "";
          let footVName = "";
          if (this.dataFootnoteAll[footnoteName] || this.dataFootnote[footnoteName]) {
            let footnoteFirst!: string;
            if (this.dataFootnote[footnoteName]) {
              this.dataFootnote[footnoteName]["list"].push(footnoteNumStr);
              footnoteFirst = this.dataFootnote[footnoteName]["list"][0];
            } else {
              this.dataFootnote[footnoteName] = {
                list: [footnoteNumStr],
                data: footnoteTextData,
              };
              footnoteFirst = this.dataFootnoteAll[footnoteName]["list"][0];
            }

            fn = this.docSet["docInclude"] + "fn_" + footnoteFirst;
            rfn = this.docSet["docInclude"] + "rfn_" + footnoteNumStr;

            if (useFootnoteNumber === "only_number") {
              footVName += footnoteFirst;
            } else {
              footVName += footnoteName;
            }

            if (useViewRealFootnoteNum === "on") {
              footVName += ` ${footnoteNumStr}`;
            }
          } else {
            this.dataFootnote[footnoteName] = {
              list: [footnoteNumStr],
              data: footnoteTextData,
            };

            fn = this.docSet["docInclude"] + "fn_" + footnoteNumStr;
            rfn = this.docSet["docInclude"] + "rfn_" + footnoteNumStr;

            if (useFootnoteNumber === "only_number") {
              footVName += footnoteNumStr;
            } else {
              footVName += footnoteName;
            }

            if (useViewRealFootnoteNum === "on") {
              footVName += footnoteNameAdd;
            }
          }

          let dataName!: string;
          if (useFootnoteSet === "spread") {
            dataName = this.getToolDataStorage(
              "<sup>" +
                '<a fn_target="' +
                fn +
                '" id="' +
                rfn +
                '" href="javascript:void(0);">(' +
                footVName +
                ")</a>" +
                "</sup>" +
                '<span class="opennamu_spead_footnote" id="' +
                rfn +
                '_load" style="display: none;"></span>',
              "",
              footnoteDataOriginal
            );
            this.renderDataJS +=
              'document.getElementById("' +
              rfn +
              '").addEventListener("click", function() { opennamu_do_footnote_spread("' +
              rfn +
              '", "' +
              fn +
              '"); });\n';
          } else if (useFootnoteSet === "popup") {
            dataName = this.getToolDataStorage(
              "<sup>" +
                '<a fn_target="' +
                fn +
                '" id="' +
                rfn +
                '" href="javascript:void(0);">(' +
                footVName +
                ")</a>" +
                "</sup>" +
                '<span class="opennamu_spead_footnote" id="' +
                rfn +
                '_load" style="display: none;"></span>',
              "",
              footnoteDataOriginal
            );
            this.renderDataJS +=
              'document.getElementById("' +
              rfn +
              '").addEventListener("click", function() { opennamu_do_footnote_spread("' +
              rfn +
              '", "' +
              fn +
              '"); });\n';
          } else if (useFootnoteSet === "popover") {
            dataName = this.getToolDataStorage(
              '<span id="' +
                rfn +
                '_over">' +
                "<sup>" +
                '<a fn_target="' +
                fn +
                '" id="' +
                rfn +
                '" href="javascript:void(0);">(' +
                footVName +
                ")</a>" +
                "</sup>" +
                '<span class="opennamu_popup_footnote" id="' +
                rfn +
                '_load" style="display: none;"></span>' +
                "</span>",
              "",
              footnoteDataOriginal
            );
            this.renderDataJS +=
              'document.getElementById("' +
              rfn +
              '_over").addEventListener("click", function() { opennamu_do_footnote_popover("' +
              rfn +
              '", "' +
              fn +
              '", undefined, "open"); });\n';
            this.renderDataJS +=
              'document.addEventListener("click", function() { opennamu_do_footnote_popover("' + rfn + '", "' + fn + '", undefined, "close"); });\n';
          } else {
            dataName = this.getToolDataStorage(
              '<sup><a fn_target="' + fn + '" id="' + rfn + '" href="#' + fn + '">(' + footVName + ")</a></sup>",
              "",
              footnoteDataOriginal
            );
          }

          this.renderData = this.renderData.replace(footnoteRegex, `<${dataName}></${dataName}>`);
        }

        footnoteCountAll -= 1;
      }
    }

    this.renderData += "<footnote_category>";
    this.renderData += this.getToolFootnoteMake();
  }

  // re.sub fix
  manageText() {
    // <b> function
    const doRenderTextBold = (match: string, ...groups: string[]) => {
      const data = groups[0];
      let dataName;

      const useBold = this.config.useBold;
      if (useBold === "delete") {
        return "";
      } else if (useBold === "change") {
        dataName = this.getToolDataStorage("", "", match);
      } else {
        dataName = this.getToolDataStorage("<b>", "</b>", match);
      }

      return `<${dataName}>${data}</${dataName}>`;
    };

    // <b>
    this.renderData = this.renderData.replace(/&#x27;&#x27;&#x27;((?:(?!&#x27;&#x27;&#x27;).)+)&#x27;&#x27;&#x27;/g, doRenderTextBold);

    // <i> function
    const doRenderTextItalic = (match: string, p1: string) => {
      const data = p1;
      const dataName = this.getToolDataStorage("<i>", "</i>", match);
      return `<${dataName}>${data}</${dataName}>`;
    };

    // <i>
    this.renderData = this.renderData.replace(/&#x27;&#x27;((?:(?!&#x27;&#x27;).)+)&#x27;&#x27;/g, doRenderTextItalic);

    // <u> function
    const doRenderTextUnder = (match: string, p1: string) => {
      const data = p1;
      const dataName = this.getToolDataStorage("<u>", "</u>", match);
      return `<${dataName}>${data}</${dataName}>`;
    };

    // <u>
    this.renderData = this.renderData.replace(/__((?:(?!__).)+)__/g, doRenderTextUnder);

    // <sup> function
    const doRenderTextSup = (match: string, p1: string) => {
      const data = p1;
      const dataName = this.getToolDataStorage("<sup>", "</sup>", match);
      return `<${dataName}>${data}</${dataName}>`;
    };

    // <sup>
    this.renderData = this.renderData.replace(/\^\^\^((?:(?!\^\^\^).)+)\^\^\^/g, doRenderTextSup);
    // <sup> 2
    this.renderData = this.renderData.replace(/\^\^((?:(?!\^\^).)+)\^\^/g, doRenderTextSup);

    // <sub> function
    const doRenderTextSub = (match: string, p1: string) => {
      const data = p1;
      const dataName = this.getToolDataStorage("<sub>", "</sub>", match);
      return `<${dataName}>${data}</${dataName}>`;
    };

    // <sub>
    this.renderData = this.renderData.replace(/,,,(?:(?!,,,).)+,,,/g, doRenderTextSub);
    // <sub> 2
    this.renderData = this.renderData.replace(/,,((?:(?!,,).)+),,/g, doRenderTextSub);

    // <s> function
    const doRenderTextStrike = (match: string, p1: string) => {
      const data = p1;
      let dataName;

      const useStrike = this.config.useStrike;
      if (useStrike === "delete") {
        return "";
      } else if (useStrike === "change") {
        dataName = this.getToolDataStorage("", "", match);
      } else {
        dataName = this.getToolDataStorage("<s>", "</s>", match);
      }

      return `<${dataName}>${data}</${dataName}>`;
    };

    // <s>
    this.renderData = this.renderData.replace(/--((?:(?!--).)+)--/g, doRenderTextStrike);
    // <s> 2
    this.renderData = this.renderData.replace(/~~((?:(?!~~).)+)~~/g, doRenderTextStrike);
  }

  // re.sub fix
  manageHr() {
    const hrRegex = /\n-{4,9}\n/;
    let hrCountMax = (this.renderData.match(new RegExp(hrRegex, "g")) || []).length * 3;

    while (true) {
      const hrData = hrRegex.exec(this.renderData);
      if (hrCountMax < 0) {
        break;
      } else if (!hrData) {
        break;
      } else {
        this.renderData = this.renderData.replace(hrRegex, "\n<front_br><hr><back_br>\n");
      }

      hrCountMax -= 1;
    }
  }

  manageHeading() {
    let tocList: [string, string][] = [];

    // make heading base
    const headingRegex = /\n((={1,6})(#?) ?([^\n]+))\n/;
    let headingCountAll = (this.renderData.match(globalRegExp(headingRegex)) || []).length * 3;
    let headingStack = [0, 0, 0, 0, 0, 0];
    let headingCount = 0;

    while (true) {
      headingCount += 1;

      const headingDataMatch = headingRegex.exec(this.renderData);
      if (!headingDataMatch) {
        break;
      } else if (headingCountAll < 0) {
        console.error("Error : render heading count overflow");
        break;
      }

      const headingDataOrg = headingDataMatch[0];
      let headingData = headingDataMatch.slice(1);

      const headingDataLastRegex = / ?(#?={1,6}[^=]*)$/;
      const headingDataLastMatch = headingData[3].match(headingDataLastRegex);
      let headingDataLast = headingDataLastMatch ? headingDataLastMatch[1] : "";

      const headingDataText = headingData[3].replace(globalRegExp(headingDataLastRegex), "");

      const headingDataDiff = headingData[2] + headingData[1];
      if (headingDataDiff !== headingDataLast) {
        // front != back -> restore
        let headingDataAll = headingData[0];

        for (let index = 6; index >= 1; index--) {
          const headingRestoreRegex = new RegExp("^={" + index + "}|={" + index + "}$");
          headingDataAll = headingDataAll.replace(headingRestoreRegex, "<heading_" + index + ">");
        }

        this.renderData = this.renderData.replace(headingRegex, "\n" + headingDataAll + "\n");
      } else {
        let headingLevel = headingData[1].length;
        headingStack[headingLevel - 1] += 1;
        for (let index = headingLevel; index < 6; index++) {
          headingStack[index] = 0;
        }

        const headingStackStr = headingStack.join(".").replace(/(\.0)+$/g, "");
        tocList.push(["", headingDataText]);

        let headingFolding = ["⊖", "block", "1"];
        if (headingData[2]) headingFolding = ["⊕", "none", "0.5"];

        let headingIdName = "edit_load_" + headingCount;
        if (this.docSet["docType"] !== "view") headingIdName = this.docSet["docInclude"] + "edit_load_" + headingCount;

        const dataName = this.getToolDataStorage(
          "<h" +
            headingLevel +
            '><span id="' +
            this.docSet["docInclude"] +
            "opennamu_heading_" +
            headingCount +
            '_sub" style="opacity: ' +
            headingFolding[2] +
            '">',
          " <sub>" +
            '<a id="' +
            headingIdName +
            '" href="/edit_section/' +
            headingCount +
            "/" +
            urlPas(this.docName) +
            '">✎</a> ' +
            '<a href="javascript:void(0);" onclick="javascript:opennamu_heading_folding(\'' +
            this.docSet["docInclude"] +
            "opennamu_heading_" +
            headingCount +
            "', this);\">" +
            headingFolding[0] +
            "</a></sub>" +
            "</span></h" +
            headingLevel +
            ">",
          headingDataOrg
        );

        const headingDataComplete =
          "" +
          "\n<front_br>" +
          (headingCount != 1 ? "</div>" : "") +
          "<" +
          dataName +
          ">" +
          "<heading_stack>" +
          headingStackStr +
          "</heading_stack>" +
          " " +
          headingDataText +
          "</" +
          dataName +
          ">" +
          '<div id="' +
          this.docSet["docInclude"] +
          "opennamu_heading_" +
          headingCount +
          '" style="display: ' +
          headingFolding[1] +
          ';">' +
          "<back_br>\n" +
          "";

        this.renderData = this.renderData.replace(headingRegex, headingDataComplete);
      }

      headingCountAll -= 1;
    }

    // heading id adjust
    const headingEndCount = (this.renderData.match(/<heading_stack>/g) || []).length;
    for (let index = 5; index >= 0; index--) {
      const headingEndStackRegex = new RegExp("<heading_stack>" + "0\\.".repeat(index), "g");
      const headingEndMatchCount = (this.renderData.match(headingEndStackRegex) || []).length;
      if (headingEndMatchCount === headingEndCount) {
        this.renderData = this.renderData.replace(headingEndStackRegex, "<heading_stack>");
        break;
      }
    }

    // heading id -> inline id
    const headingIdRegex = /<heading_stack>([^<>]+)<\/heading_stack>/;
    const headingIdRegexGlobal = /<heading_stack>([^<>]+)<\/heading_stack>/g;

    let match;
    const results: RegExpExecArray[] = [];

    while ((match = headingIdRegexGlobal.exec(this.renderData)) !== null) {
      results.push(match);
    }

    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      const content = `<a href="#toc" id="s-${result[1]}">${result[1]}.</a>`;
      this.renderData = this.renderData.replace(headingIdRegex, content);
      tocList[index][0] = result[1];
    }

    // not heading restore
    for (let index = 1; index < 7; index++) {
      const headingRestoreRegex = new RegExp("<heading_" + index + ">", "g");
      this.renderData = this.renderData.replace(headingRestoreRegex, "=".repeat(index));
    }

    // make toc
    let tocData = "";
    if (tocList.length !== 0) {
      tocData = "" + '<div class="opennamu_TOC" id="toc">' + '<span class="opennamu_TOC_title">' + "목차" + "</span>" + "<br>" + "";
    }

    for (const element of tocList) {
      tocData +=
        "" +
        "<br>" +
        '<span style="margin-left: 10px;"></span>'.repeat(element[0].split(".").length - 1) +
        '<span class="opennamu_TOC_list">' +
        '<a href="#s-' +
        element[0] +
        '">' +
        element[0] +
        ". " +
        "</a>" +
        "<toc_inside>" +
        element[1] +
        "</toc_inside>" +
        "</span>" +
        "";
    }

    if (tocData !== "") {
      tocData += "</div>";

      this.dataToc = tocData;
      this.renderData += "<toc_data>" + tocData + "</toc_data>";
    } else {
      this.dataToc = "";
    }
  }

  finalize() {
    this.renderData = this.renderData.replaceAll("<no_br>", "\n");
    this.renderData = this.renderData.replaceAll("<no_td>", "||");

    console.log(this.docSet)
    // add category
    if (this.docSet["docType"] === "view") {
      if (this.dataCategory !== "") {
        let dataName = this.getToolDataStorage(this.dataCategory, "</div>", "");
        const useCategorySet = this.config.useCategorySet;

        if (useCategorySet === "bottom") {
          if (/<footnote_category>/.test(this.renderData)) {
            this.renderData = this.renderData.replace(/<footnote_category>/, `<hr><${dataName}></${dataName}>`);
          } else {
            this.renderData += `<hr><${dataName}></${dataName}>`;
          }
        } else {
          this.renderData = this.renderData.replace(/<footnote_category>/, "");
          this.renderData = `<${dataName}></${dataName}><hr class="main_hr">${this.renderData}`;
        }
      } else {
        this.renderData = this.renderData.replace(/<footnote_category>/, "");
      }
    } else {
      this.renderData = this.renderData.replace(/<footnote_category>/, "");
    }

    // remove front_br and back_br
    this.renderData = this.renderData.replace(/\n?<front_br>/g, "");
    this.renderData = this.renderData.replace(/<back_br>\n?/g, "");

    // \n to <br>
    this.renderData = this.renderData.replace(/\n/g, "<br>");

    // <render_n> restore
    this.renderData = this.getToolDataRestore(this.renderData);

    // a fix
    this.tempALinkCount = 0;

    const handlerALink = (match: string, p1: string) => {
      const data = p1;
      if (data === "</a>") {
        if (this.tempALinkCount === 0) {
          return "";
        } else if (this.tempALinkCount > 1) {
          this.tempALinkCount -= 1;
          return "";
        } else {
          this.tempALinkCount -= 1;
          return match;
        }
      } else {
        if (this.tempALinkCount > 0) {
          this.tempALinkCount += 1;
          return "";
        } else {
          this.tempALinkCount += 1;
          return match;
        }
      }
    };

    this.renderData = this.renderData.replace(/(<a(?: [^<>]*)?>|<\/a>)/g, handlerALink);

    const handlerTocFilter = (match: string, p1: string) => {
      let data = p1.split(" ");
      if (data[0] === "a" || data[0] === "/a") {
        if (data.length > 3 && data[3] != 'href="javascript:void(0);"') {
          return `<${p1}>`;
        } else {
          return "";
        }
      } else {
        return "";
      }
    };

    // add toc
    const handlerToc = (match: string, p1: string) => {
      let data = p1;
      let dataSub = data.replace(/<([^<>]*)>/g, "");
      data = data.replace(/<([^<>]*)>/g, handlerTocFilter);

      const headingRegex = /<h([1-6])>/;
      const headingData = headingRegex.exec(this.renderData);
      if (headingData) {
        const headingLevel = headingData[1];
        this.renderData = this.renderData.replace(headingRegex, `<h${headingLevel} id="${dataSub}">`);
      }

      return data;
    };

    if (this.dataToc !== "") {
      this.renderData += "</div>";
      const tocSearchRegex = /<toc_data>((?:(?!<toc_data>|<\/toc_data>).)*)<\/toc_data>/;
      let tocDataOn = 0;

      const tocData = this.renderData.match(tocSearchRegex) || [];
      let tocDataNew = tocData ? tocData[1] : "";
      this.dataToc = tocDataNew;
      this.dataToc = this.dataToc.replace(/<toc_inside>((?:(?!<toc_inside>|<\/toc_inside>).)*)<\/toc_inside>/g, handlerToc);

      const useTocSet = this.config.useTocSet;

      this.renderData = this.renderData.replace(new RegExp(tocSearchRegex), "");
      if (useTocSet === "off") {
        this.renderData = this.renderData.replace(/<toc_need_part>/g, "");
      } else {
        if (this.renderData.match(tocSearchRegex)) {
          tocDataOn = 1;
        }

        const tmpRegex = /<toc_need_part>/;
        for (let i = 0; i < 20; i++) {
          this.renderData = this.renderData.replace(tmpRegex, this.dataToc);
        }
        this.renderData = this.renderData.replace(/<toc_need_part>/g, "");
      }

      if (
        this.docSet["docType"] !== "view" ||
        this.renderData.match(/<toc_no_auto>/) ||
        useTocSet === "half_off" ||
        useTocSet === "off" ||
        tocDataOn === 1
      ) {
        this.renderData = this.renderData.replace(/<toc_no_auto>/g, "");
      } else {
        this.renderData = this.renderData.replace(/(?<in><h[1-6] id="[^"]*">)/, `<br>${this.dataToc}$<in>`);
      }
    } else {
      this.renderData = this.renderData.replace(/<toc_need_part>/g, "");
      this.renderData = this.renderData.replace(/<toc_no_auto>/g, "");
    }

    const handlerFootnote = (match: string, p1: string) => {
      const findRegex = new RegExp('<footnote_title id="' + p1 + '">((?:(?!<footnote_title|</footnote_title>).)*)</footnote_title>');
      let findData = this.renderData.match(findRegex);
      let findDataNew!: string;
      if (findData) {
        findDataNew = findData[1];
        findDataNew = findDataNew.replace(/<[^<>]*>/g, "");
      } else {
        findDataNew = "";
      }

      return '<a title="' + findDataNew + '"';
    };

    this.renderData = this.renderData.replace(/<a fn_target="([^"]+)"/, handlerFootnote);

    this.renderDataJS += `document.querySelectorAll('details').forEach((el) => {new Accordion(el);});if(window.location.hash !== '' && document.getElementById(window.location.hash.replace(/^#/, ''))) {document.getElementById(window.location.hash.replace(/^#/, '')).focus();}\nopennamu_do_ip_render();\n`;
  }

  manageAfterwork() {

  }

  parse(): {
    0: string;
    1: string;
    2: {
      backlink: any[][];
      backlink_dict: Record<string, any>;
      footnote: Record<
        string,
        {
          list: string[];
          data: string;
        }
      >;
      category: string[];
      temp_storage: any[];
      link_count: number;
    };
  } {
    this.manageRemark();
    this.manageIncludeDefault();
    this.manageSlash();
    this.manageMiddle();
    this.manageInclude();
    this.manageMath();
    this.manageTable();
    this.manageList();
    this.manageMacro();
    this.manageLink();
    this.manageText();
    this.manageHr();
    if (this.doType === "exter") {
      this.manageFootnote();
      this.manageHeading();
      this.finalize();
      this.renderDataJS = `window.addEventListener("load", function(){ ${this.renderDataJS} })`
    } else {
      this.renderData = this.renderData.replace(/\|\|/g, "<no_td>");
      this.renderData = this.renderData.replace(/\n/g, "<no_br>");
    }
    this.manageAfterwork();

    const dataBacklinkDict = this.dataBacklink;
    const dataBacklinkList = [];
    for (const forA of Object.keys(this.dataBacklink)) {
      for (const forB of Object.keys(this.dataBacklink[forA])) {
        dataBacklinkList.push([this.docName, forA, forB, this.dataBacklink[forA][forB]]);
      }
    }

    return [
      this.renderData,
      this.renderDataJS,
      {
        backlink: dataBacklinkList,
        backlink_dict: dataBacklinkDict,
        footnote: this.dataFootnoteAll,
        category: this.dataCategoryList,
        temp_storage: [this.dataTempStorage, this.dataTempStorageCount],
        link_count: this.linkCount,
        // redirect: this.dataRedirect
      },
    ];
  }
}
