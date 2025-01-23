import crypto from "node:crypto";

const urlPas = (data: string) => {
  return encodeURIComponent(data.replace(/^\./g, "\\\\.")).replaceAll("/", "%2F");
};

function sha224Replace(data: string) {
  return crypto.createHash("sha224").update(data, "utf-8").digest("hex");
}

function escapeHtml(text: string) {
  return text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function unescapeHtml(html: string) {
  return html
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'");
}

interface IDatabase {
  data: { data: string; title: string }[];
}

interface IDocSet {
  docInclude: string;
}

interface IConfig {
  docName: string;
  docSet: IDocSet;
  useBold?: boolean;
  useStrike?: boolean;
  useIncludeLink?: boolean;
  useCategorySet?: boolean;
  useTocSet?: boolean;
}

export class NamuMark {
  wikiText: string = "";

  dataTempStorage: Record<string, string> = {};
  dataTempStorageCount: number = 0;
  dataInclude: string[][] = [];
  dataBacklink: string[][] = [];
  dataMathCount = 0;

  dataToc = "";
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
  docSet: IDocSet;
  docInclude: string = "";
  config!: IConfig;

  renderDataJS = "";
  darkmode = "0";

  database!: IDatabase;

  tempALinkCount!: number;

  constructor(wikiText: string, config: IConfig, database: IDatabase) {
    this.wikiText = wikiText.replace("\r", "");
    this.wikiText = "<back_br>\n" + escapeHtml(this.wikiText) + "\n<front_br>";

    this.docName = config.docName;
    this.docSet = config.docSet;
    this.docInclude = this.docSet["docInclude"] || "";
    this.config = config;

    this.database = database;
  }

  getToolDataStorage = (dataA = "", dataB = "", dataC = "", doType = "render") => {
    this.dataTempStorageCount += 1;
    let dataName!: string;
    if (doType === "render") {
      dataName = "render_" + this.dataTempStorageCount;
      this.dataTempStorage[dataName] = dataA;
      this.dataTempStorage["/" + dataName] = dataB;
      this.dataTempStorage["revert_" + dataName] = dataC;
    } else {
      dataName = "slash_" + String(this.dataTempStorageCount);
      this.dataTempStorage[dataName] = dataA;
    }
    return dataName;
  };

  getToolDataRestore = (data: string, doType = "all") => {
    let storageCount = this.dataTempStorageCount * 3;
    const storageRegex =
      doType === "all" ? /<(\/?(?:render|slash)_(?:[0-9]+))>/ : doType === "render" ? /<(\/?(?:render)_(?:[0-9]+))>/ : /<(\/?(?:slash)_(?:[0-9]+))>/;

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
        ? /(?:<((slash)_(?:[0-9]+))>|<((render)_(?:[0-9]+))>(?:(?:(?!<(?:\/?render_(?:[0-9]+))>).|\n)*)<\/render_(?:[0-9]+)>)/
        : doType === "render"
        ? /<((render)_(?:[0-9]+))>(?:(?:(?!<(?:\/?render_(?:[0-9]+))>).)*)<\/render_(?:[0-9]+)>/
        : /<((slash)_(?:[0-9]+))>/;
    while (true) {
      const match = data.match(storageRegex);
      if (!match) break;
      if (storageCount < 0) {
        console.log("Error: render restore count overflow");
        break;
      } else {
        let dataRevert!: string;
        if (match[1] && match[1] === "render") {
          dataRevert = (this.dataTempStorage[`revert_${match[0]}`]) || "";
        } else {
          if (match.length > 3 && match[3] === "render") {
            dataRevert = this.dataTempStorage[`revert_${match[2]}`] || "";
          } else {
            dataRevert = `\\${this.dataTempStorage[match[0]]}`;
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
          data += `<sup><a id="${this.docInclude}fn_${forB}" href="#${this.docInclude}rfn_${forB}">(${forB})</a></sup> `;
        }
      } else {
        data += `<a id="${this.docInclude}fn_${this.dataFootnote[forA]["list"][0]}" href="#${this.docInclude}rfn_${this.dataFootnote[forA]["list"][0]}">(${forA}) </a> `;
      }

      data += `<footnote_title target="${this.docInclude}fn_${this.dataFootnote[forA]["list"][0]}">${this.dataFootnote[forA]["data"]}</footnote_title>`;
    }

    if (data !== "") {
      data += "</div>";
    }

    this.dataFootnote = {};
    return data; // 결과 값을 반환합니다.
  }

  manageRemark() {
    this.wikiText = this.wikiText.replace(/\n##[^\n]+/g, "\n<front_br>");
  }

  manageIncludeDefault() {
    const handler: (match: string, ...args: string[]) => string = (match, p1, p2, p3) => {
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

    this.wikiText = this.wikiText.replace(/(\\+)?@([ㄱ-힣a-zA-Z]+)=((?:\\@|[^@\n])+)@/g, handler);
    this.wikiText = this.wikiText.replace(/(\\+)?@([ㄱ-힣a-zA-Z]+)@/g, handler);
  }

  // re.sub fix
  manageInclude() {
    let includeChangeList: Record<string, string> = {};

    const handler: (match: string, ...args: any[]) => string = (match, p1, p2, p3) => {
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

        if (includeChangeList[match[1]]) {
          return slashAdd + includeChangeList[matches[1]];
        } else {
          return slashAdd + matches[2];
        }
      }
    };

    let includeNum = 0;
    const includeRegex = /\[include\(((?:(?!\[include\(|\)\]|<\/div>).)+)\)\]/i;
    let includeCountMax = (this.wikiText.match(includeRegex) || []).length * 10;
    while (true) {
      includeNum += 1;
      includeChangeList = {};
      let match = this.wikiText.match(includeRegex);
      if (includeCountMax < 0) {
        break;
      } else if (!match) {
        break;
      } else {
        if (this.docInclude != "") {
          this.wikiText = this.wikiText.replace(includeRegex, "");
        } else {
          const matchOriginal = match[0];
          const macroSplitRegex = /(?:^|,) *([^,]+)/;
          const macroSplitSubRegex = /^([^=]+) *= *(.*)$/;
          let includeName = "";

          let data = match[1].match(new RegExp(macroSplitRegex, "g")) || [];
          for (const datum of data) {
            const dataSub = datum.match(macroSplitSubRegex);
            if (dataSub) {
              const dataSubName = dataSub[1];
              let dataSubData = this.getToolDataRestore(dataSub[2], "slash")
                .replace(/^분류:/g, ":분류:")
                .replace(/^파일:/g, ":파일:");
              includeChangeList[dataSubName] = dataSubData;
            } else {
              includeName = datum;
            }
          }

          const includeNameOriginal = includeName;
          includeName = unescapeHtml(this.getToolDataRestore(includeName, "slash"));

          // FIXME: no db!
          const dbData = this.database.data.find((value) => value.title === includeName)?.data;
          let dataName!: string;
          if (dbData) {
            this.dataBacklink.push(...[[this.docName, includeName, "include"]]);
            let includeData = dbData.replace(/\r/g, "");

            // REFERENCE
            //   if ip_or_user(self.ip) === 0:
            //     self.curs.execute(db_change('select data from user_set where name = "main_css_include_link" and id = ?'), [self.ip])
            //     db_data = self.curs.fetchall()
            //     include_set_data = db_data[0][0] if db_data else 'normal'
            // else:
            //     include_set_data = self.flask_session['main_css_include_link'] if 'main_css_include_link' in self.flask_session else 'normal'
            let includeLink = "";
            // REFERENCE
            // if include_set_data === 'use':
            //   include_link = '<div><a href="/w/' + url_pas(include_name) + '">(' + include_name_org + ')</a></div>'
            includeData = includeData.replace(/(\\+)?@([ㄱ-힣a-zA-Z]+)=((?:\\@|[^@\n])+)@/g, handler);
            includeData = includeData.replace(/(\\+)?@([ㄱ-힣a-zA-Z]+)@/g, handler);

            includeData = includeData.replace(/^\n+/g, "");

            this.dataInclude.push(...[[this.docInclude + "opennamu_include_" + includeNum, includeName, includeData, 'style="display: inline;"']]);

            dataName = this.getToolDataStorage(
              `${includeLink}<div id="${this.docInclude}opennamu_include_${includeNum}"></div>`,
              "",
              matchOriginal
            );
          } else {
            this.dataBacklink.push(...[[this.docName, includeName, "no"]]);
            let includeLink = '<div><a class="opennamu_not_exist_link" href="/w/' + urlPas(includeName) + '">(' + includeNameOriginal + ")</a></div>";
            dataName = this.getToolDataStorage(includeLink, "", matchOriginal);
          }

          this.wikiText = this.wikiText.replace(includeRegex, `<${dataName}></${dataName}>`);
        }
      }

      includeCountMax -= 1;
    }
  }

  manageSlash() {
    const handler: (match: string, ...args: any[]) => string = (match, p1) => {
      if (p1 === "<") {
        return "<";
      } else {
        const dataName = this.getToolDataStorage(p1, undefined, undefined, "slash");
        return `<${dataName}>`;
      }
    };
    this.wikiText = this.wikiText.replace(/\\(&lt;|&gt;|&#x27;|&quot;|&amp;|.)/g, handler);
  }

  // re.sub fix
  manageMiddle() {
    const middleRegex = /{{{([^{](?:(?!{{{|}}}).|\n)*)?(?:}|<(\/?(?:slash)_(?:[0-9]+))>)}}/;
    let wikiCount = 0;
    let syntaxCount = 0;
    let foldingCount = 0;
    let middleCountAll = (this.wikiText.match(middleRegex) || []).length * 10;
    while (true) {
      const middleData = this.wikiText.match(middleRegex) || null;
      let middleDataNew!: string;
      if (middleCountAll < 0) {
        break;
      } else if (!middleData) {
        break;
      } else {
        let middleDataOriginal = middleData[0];
        const middleSlash = middleData[2];

        if (middleSlash) {
          if (this.dataTempStorage[middleSlash] !== "}") {
            middleDataOriginal = middleDataOriginal.replace(/<(\/?(?:slash)_(?:[0-9]+))>/g, `<temp_${middleSlash}>`);
            this.wikiText = this.wikiText.replace(middleRegex, middleDataOriginal);
            continue;
          }
        }

        middleDataNew = middleData[1];
        if (!middleDataNew) {
          middleDataNew = "";
        }

        const middleName = middleDataNew.match(/^([^ \n]+)/);
        let middleNameNew!: string;
        let middleDataPass = "";
        let dataName = "";
        let wikiSize = "";
        if (middleName) {
          middleNameNew = middleName[1]?.toLowerCase();
          if (middleNameNew === "#!wiki") {
            if (middleSlash) {
              middleDataOriginal = middleDataOriginal.replace(/<(\/?(?:slash)_(?:[0-9]+))>/g, "<temp_" + middleSlash + ">");
              this.wikiText = this.wikiText.replace(middleRegex, middleDataOriginal);
              continue;
            }

            const wikiRegex = /^#!wiki(?:(?: style=(&quot;(?:(?:(?!&quot;).)*)&quot;|&#039;(?:(?:(?!&#039;).)*)&#039;))| [^\n]*)?\n/i;
            const wikiDataStyle = middleDataNew.match(wikiRegex);
            let wikiDataStyleNew!: string;
            let wikiData = middleDataNew.replace(wikiRegex, "");
            if (wikiDataStyle) {
              wikiDataStyleNew = wikiDataStyle[1];
              if (wikiDataStyleNew) {
                wikiDataStyleNew = wikiDataStyleNew.replaceAll("&#039;", "'");
                wikiDataStyleNew = wikiDataStyleNew.replaceAll("&quot;", '"');
                wikiDataStyleNew = "style=" + wikiDataStyleNew;
              } else {
                wikiDataStyleNew = "";
              }
            } else {
              wikiDataStyleNew = "";
            }

            wikiData = unescapeHtml(this.getToolDataRevert(wikiData).replace(/(^\n|\n$)/g, ""));
            this.dataInclude.push(...[[this.docInclude + "opennamu_wiki_" + wikiCount, this.docName, wikiData, wikiDataStyleNew]]);

            dataName = this.getToolDataStorage(`<div id="${this.docInclude}opennamu_wiki_${wikiCount}" ${wikiDataStyleNew}>${wikiData}</div>`, "", middleDataOriginal);
            wikiCount += 1;
          } else if (middleNameNew === "#!html") {
            if (middleSlash) {
              middleDataOriginal = middleDataOriginal.replace(/<(\/?(?:slash)_(?:[0-9]+))>/g, "<temp_" + middleSlash + ">");
              this.wikiText = this.wikiText.replace(middleRegex, middleDataOriginal);
              continue;
            }

            dataName = this.getToolDataStorage("", "", middleDataOriginal);
          } else if (middleNameNew === "#!folding") {
            if (middleSlash) {
              middleDataOriginal = middleDataOriginal.replace(/<(\/?(?:slash)_(?:[0-9]+))>/g, "<temp_" + middleSlash + ">");
              this.wikiText = this.wikiText.replace(middleRegex, middleDataOriginal);
              continue;
            }

            const wikiRegex = /^#!folding(?: ([^\n]*))?\n/i;
            let wikiDataFolding = middleDataNew.match(wikiRegex);
            let wikiDataFoldingNew;
            let wikiData = middleDataNew.replace(wikiRegex, "");
            if (wikiDataFolding) {
              wikiDataFoldingNew = wikiDataFolding[1];
              if (!wikiDataFoldingNew) {
                wikiDataFoldingNew = "test";
              }
            } else {
              wikiDataFoldingNew = "test";
            }

            wikiData = unescapeHtml(this.getToolDataRevert(wikiData)).replace(/\n$/g, "");
            this.dataInclude.push(...[[this.docInclude + "opennamu_folding_" + foldingCount, this.docName, wikiData]]);

            middleDataPass = wikiDataFoldingNew;
            dataName = this.getToolDataStorage(
              "<details><summary>",
              '</summary><div id="' + this.docInclude + "opennamu_folding_" + foldingCount + '"></div></details>',
              middleDataOriginal
            );
            foldingCount += 1;
          } else if (middleNameNew === "#!syntax") {
            if (middleSlash) {
              middleDataOriginal = middleDataOriginal.replace(/<(\/?(?:slash)_(?:[0-9]+))>/g, `<temp_${middleSlash}>`);
              this.wikiText = this.wikiText.replace(middleRegex, middleDataOriginal);
              continue;
            }

            const wikiRegex = /^#!syntax(?: ([^\n]*))?\n/i;
            let wikiDataSyntax = middleDataNew.match(wikiRegex);
            let wikiDataSyntaxNew;
            let wikiData = middleDataNew.replace(wikiRegex, "");
            if (wikiDataSyntax) {
              wikiDataSyntaxNew = wikiDataSyntax[1];
              if (!wikiDataSyntaxNew) {
                wikiDataSyntaxNew = "python";
              }
            } else {
              wikiDataSyntaxNew = "python";
            }

            if (syntaxCount === 0) {
              this.renderDataJS += "hljs.highlightAll();\n";
            }

            dataName = this.getToolDataStorage(
              '<pre id="syntax"><code class="' + wikiDataSyntax + '">' + wikiData,
              "</code></pre>",
              middleDataOriginal
            );
            syntaxCount += 1;
          } else if (["+5", "+4", "+3", "+2", "+1"].includes(middleNameNew)) {
            if (middleSlash) {
              middleDataOriginal = middleDataOriginal.replace(/<(\/?(?:slash)_(?:[0-9]+))>/g, "<temp_" + middleSlash + ">");
              this.wikiText = this.wikiText.replace(middleRegex, middleDataOriginal);
              continue;
            }

            const wikiData = middleDataNew.replace(/^\+[1-5] /g, "");

            if (middleNameNew === "+5") wikiSize = "200";
            else if (middleNameNew === "+4") wikiSize = "180";
            else if (middleNameNew === "+3") wikiSize = "160";
            else if (middleNameNew === "+2") wikiSize = "140";
            else wikiSize = "120";

            middleDataPass = wikiData;
            dataName = this.getToolDataStorage('<span style="font-size:' + wikiSize + '%">', "</span>", middleDataOriginal);
          } else if (["-5", "-4", "-3", "-2", "-1"].includes(middleNameNew)) {
            if (middleSlash) {
              middleDataOriginal = middleDataOriginal.replace(/<(\/?(?:slash)_(?:[0-9]+))>/g, "<temp_" + middleSlash + ">");
              this.wikiText = this.wikiText.replace(middleRegex, middleDataOriginal);
              continue;
            }

            const wikiData = middleDataNew.replace(/^\-[1-5] /g, "");
            if (middleNameNew === "-5") wikiSize = "50";
            else if (middleNameNew === "-4") wikiSize = "60";
            else if (middleNameNew === "-3") wikiSize = "70";
            else if (middleNameNew === "-2") wikiSize = "80";
            else wikiSize = "90";

            middleDataPass = wikiData;
            dataName = this.getToolDataStorage('<span style="font-size:' + wikiSize + '%">', "</span>", middleDataOriginal);
          } else if (middleNameNew?.match(/^@(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+))/)) {
            if (middleSlash) {
              middleDataOriginal = middleDataOriginal.replace(/<(\/?(?:slash)_(?:[0-9]+))>/g, "<temp_" + middleSlash + ">");
              this.wikiText = this.wikiText.replace(middleRegex, middleDataOriginal);
              continue;
            }
            const wikiColor = middleNameNew.match(/^@(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+))(,@(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+)))?/);
            let wikiColorData = "";
            if (wikiColor) {
              if (wikiColor[1]) {
                wikiColorData += "#" + wikiColor[1];
              } else {
                wikiColorData += wikiColor[2];
              }

              if (wikiColor[3]) {
                if (wikiColor[4]) {
                  wikiColorData += ",#" + wikiColor[4];
                } else if (wikiColor[5]) {
                  wikiColorData += "," + wikiColor[5];
                }
              }
            } else {
              wikiColorData += "red";
            }

            let wikiColorNew = this.getToolDarkModeSplit(this.getToolCssSafe(wikiColorData));
            let wikiData = middleDataNew.replace(/^@(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+))(?:,@(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+)))? ?/g, "");
            middleDataPass = wikiData;
            dataName = this.getToolDataStorage('<span style="background-color:' + wikiColorNew + '">', "</span>", middleDataOriginal);
          } else if (middleNameNew?.match(/^#(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+))/)) {
            if (middleSlash) {
              middleDataOriginal = middleDataOriginal.replace(/<(\/?(?:slash)_(?:[0-9]+))>/g, "<temp_" + middleSlash + ">");
              this.wikiText = this.wikiText.replace(middleRegex, middleDataOriginal);
              continue;
            }
            const wikiColor = middleNameNew.match(/^#(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+))(,#(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+)))?/);
            let wikiColorData = "";
            console.log(wikiColor);
            if (wikiColor) {
              if (wikiColor[1]) {
                wikiColorData += "#" + wikiColor[1];
              } else {
                wikiColorData += wikiColor[2];
              }

              if (wikiColor[3]) {
                if (wikiColor[4]) {
                  wikiColorData += ",#" + wikiColor[4];
                } else if (wikiColor[5]) {
                  wikiColorData += "," + wikiColor[5];
                }
              }
            } else {
              wikiColorData += "red";
            }

            let wikiColorNew = this.getToolDarkModeSplit(this.getToolCssSafe(wikiColorData));
            let wikiData = middleDataNew.replace(/^#(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+))(?:,#(?:((?:[0-9a-f-A-F]{3}){1,2})|(\w+)))? ?/g, "");
            middleDataPass = wikiData;
            dataName = this.getToolDataStorage('<span style="color:' + wikiColorNew + '">', "</span>", middleDataOriginal);
          } else {
            if (middleSlash) {
              middleDataNew += "\\";
            }

            let dataRevert = this.getToolDataRevert(middleDataNew).replace(/^\n/g, "").replace(/\n$/g, "");
            dataName = this.getToolDataStorage(dataRevert, "", middleDataOriginal);
          }
        } else {
          if (middleSlash) {
            middleDataNew += "\\";
          }

          let dataRevert = this.getToolDataRevert(middleDataNew).replace(/^\n/g, "").replace(/\n$/g, "");
          dataName = this.getToolDataStorage(dataRevert, "", middleDataOriginal);
        }
        this.wikiText = this.wikiText.replace(middleRegex, "<" + dataName + ">" + middleDataPass + "</" + dataName + ">");
      }
      middleCountAll -= 1;
    }

    this.wikiText = this.wikiText.replace(/<temp_(?<in>(?:slash)_(?:[0-9]+))>/g, "<$<in>>");
  }

  // re.sub fix
  manageMath() {
    const handler: (match: string, p1: string) => string = (match, p1) => {
      let data = p1;
      data = this.getToolDataRevert(data.replace(/\n/g, ""));
      let dataHTML = this.getToolJSSafe(data);

      data = unescapeHtml(data);
      data = this.getToolJSSafe(data);

      let nameOb = "opennamu_math_" + this.dataMathCount;
      let dataName = this.getToolDataStorage('<span id="' + nameOb + '">', "</span>", match);

      this.renderDataJS += `
try {
  katex.render("${data}", document.getElementById("${nameOb}"));
} catch {
  if (document.getElementById("${nameOb}")) {
      document.getElementById("${nameOb}").innerHTML = "<span style='color: red;'>" + ${dataHTML} + "</span>";
  }
}
      `;
      this.dataMathCount += 1;
      return `<${dataName}></${dataName}>`;
    };

    const mathRegex = /\[math\(((?:(?!\[math\(|\)\]).|\n)+)\)\]/gi;
    this.wikiText = this.wikiText.replace(mathRegex, handler);
  }

  // re.sub fix
  manageTable() {
    this.wikiText = this.wikiText.replace(/\n +\|\|/g, "\n||");

    const manageTableParameter = (cellCount: string, parameter: string, data: string, option = {}) => {
      let tableParameterAll = { div: "", class: "", table: "", tr: "", td: "", col: "", colspan: "", rowspan: "", data: "" };

      let tableAlignAuto = 1;
      let tableColspanAuto = 1;

      const tableParameterRegex = /&lt;((?:(?!&lt;|&gt;).)+)&gt;/;
      for (const tableParameter of parameter.match(tableParameterRegex) || []) {
        const tableParameterSplit = tableParameter.split("=");
        let tableParameterData!: string;
        if (tableParameterSplit.length === 2) {
          const tableParameterName = tableParameterSplit[0].replaceAll(" ", "").toLowerCase();
          tableParameterData = this.getToolCssSafe(tableParameterSplit[1]);

          if (tableParameterName === "tablebgcolor")
            tableParameterAll["table"] += "background:" + this.getToolDarkModeSplit(tableParameterData) + ";";
          else if (tableParameterName === "tablewidth") tableParameterAll["table"] += "width:" + this.getToolPxAddCheck(tableParameterData) + ";";
          else if (tableParameterName === "tableheight") tableParameterAll["table"] += "height:" + this.getToolPxAddCheck(tableParameterData) + ";";
          else if (tableParameterName === "tablealign") {
            if (tableParameterData === "right") tableParameterAll["div"] += "float:right;";
            else if (tableParameterData === "center") tableParameterAll["div"] += "margin:auto;";
            tableParameterAll["table"] += "margin:auto;";
          } else if (tableParameterName === "tableclass") tableParameterAll["class"] = tableParameterSplit[1];
          else if (tableParameterName === "tabletextalign") tableParameterAll["table"] += "text-align:" + tableParameterData + ";";
          else if (tableParameterName === "tablecolor") tableParameterAll["table"] += "color:" + this.getToolDarkModeSplit(tableParameterData) + ";";
          else if (tableParameterName === "tablebordercolor")
            tableParameterAll["table"] += "border:2px solid " + this.getToolDarkModeSplit(tableParameterData) + ";";
          else if (tableParameterName === "rowbgcolor")
            tableParameterAll["tr"] += "background:" + this.getToolDarkModeSplit(tableParameterData) + ";";
          else if (tableParameterName === "rowtextalign") tableParameterAll["tr"] += "text-align:" + tableParameterData + ";";
          else if (tableParameterName === "rowcolor") tableParameterAll["tr"] += "color:" + this.getToolDarkModeSplit(tableParameterData) + ";";
          else if (tableParameterName === "colcolor") tableParameterAll["col"] += "color:" + this.getToolDarkModeSplit(tableParameterData) + ";";
          else if (tableParameterName === "colbgcolor")
            tableParameterAll["col"] += "background:" + this.getToolDarkModeSplit(tableParameterData) + ";";
          else if (tableParameterName === "bgcolor") tableParameterAll["td"] += "background:" + this.getToolDarkModeSplit(tableParameterData) + ";";
          else if (tableParameterName === "color") tableParameterAll["td"] += "color:" + this.getToolDarkModeSplit(tableParameterData) + ";";
          else if (tableParameterName === "width") tableParameterAll["td"] += "width:" + this.getToolPxAddCheck(tableParameterData) + ";";
          else if (tableParameterName === "height") tableParameterAll["td"] += "height:" + this.getToolPxAddCheck(tableParameterData) + ";";
        } else if (tableParameterSplit.length === 1) {
          if (tableParameter.match(/^-[0-9]+$/)) {
            tableColspanAuto = 0;
            tableParameterAll["colspan"] = tableParameter.replace(/[^0-9]+/g, "");
          } else if (tableParameter.match(/^(\^|v)?\|[0-9]+$/)) {
            if (tableParameter[0] === "^") tableParameterAll["td"] += "vertical-align: top;";
            else if (tableParameter[0] === "v") tableParameterAll["td"] += "vertical-align: bottom;";

            tableParameterAll["rowspan"] = tableParameter.replace(/[^0-9]+/g, "");
          } else if (["(", ":", ")"].includes(tableParameter)) {
            tableAlignAuto = 0;
            if (tableParameter === "(") tableParameterAll["td"] += "text-align: left;";
            else if (tableParameter === ":") tableParameterAll["td"] += "text-align: center;";
            // BUG: ?
            else if (tableParameter === ")") tableParameterAll["td"] += "text-align: right;";
          } else {
            tableParameterData = this.getToolCssSafe(tableParameter);
            tableParameterAll["td"] += "background:" + this.getToolDarkModeSplit(tableParameterData) + ";";
          }
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
          if (data.match(/ $/)) {
            data = data.replace(/ $/g, "");
          }
        }
      }

      if (tableColspanAuto === 1) {
        tableParameterAll["colspan"] = String(Math.floor(cellCount.length / 2));
      }

      tableParameterAll["data"] = data;

      return tableParameterAll;
    };

    const tableRegex =
      /\n((?:(?:(?:(?:\|\|)+)|(?:\|[^|]+\|(?:\|\|)*))\n?(?:(?:(?!\|\|).)+))(?:(?:\|\||\|\|\n|(?:\|\|)+(?!\n)(?:(?:(?!\|\|).)+)\n*)*)\|\|)\n/s;
    const tableSubRegex = /(\n?)((?:\|\|)+)((?:&lt;(?:(?:(?!&lt;|&gt;).)+)&gt;)*)((?:\n*(?:(?:(?:(?!\|\|).)+)\n*)+)|(?:(?:(?!\|\|).)*))/g;
    const tableCaptionRegex = /^\|([^|]+)\|/;
    let tableCountAll = (this.wikiText.match(tableRegex) || []).length * 2;

    while (true) {
      const tableData = this.wikiText.match(tableRegex);
      let tableDataNew!: string;
      if (tableCountAll < 0) {
        console.log("Error: render table count overflow");
        break;
      } else if (!tableData) {
        break;
      } else {
        const tableDataOriginal = tableData[0];
        tableDataNew = tableData[1];

        const tableCaption = tableDataNew.match(tableCaptionRegex);
        let tableCaptionNew!: string;
        if (tableCaption) {
          tableCaptionNew = "<caption>" + tableCaption[1] + "</caption>";
          tableDataNew = tableDataNew.replace(new RegExp(tableCaptionRegex, "g"), "||");
        } else {
          tableCaptionNew = "";
        }

        const tableParameter: { div: string; class: string; table: string; col: Record<string, string>; rowspan: Record<string, number> } = {
          div: "",
          class: "",
          table: "",
          col: {},
          rowspan: {},
        };
        let tableDataEnd = "";
        let tableColNum = 0;
        let tableTrChange = 0;

        let match;
        const results = [];

        // exec()를 사용하여 모든 일치 항목을 찾기
        while ((match = tableSubRegex.exec(tableDataNew)) !== null) {
          results.push(match);
        }

        for (const tableSub of results) {
          console.log(JSON.stringify(tableSub), JSON.stringify(tableSub[3]));
          const tableDataIn = tableSub[3].replace(/^\n+/g, "");
          const tableSubParameter = manageTableParameter(tableSub[1], tableSub[2], tableDataIn);

          if (tableDataEnd === "") tableDataEnd += '<tr style="' + tableSubParameter["tr"] + '">';
          if (tableSub[0] !== "" && tableTrChange === 1) {
            tableColNum = 0;
            tableDataEnd += '</tr><tr style="' + tableSubParameter["tr"] + '">';
          }

          if (!tableParameter["rowspan"][tableColNum]) tableParameter["rowspan"][tableColNum] = 0;
          else {
            if (tableParameter["rowspan"][tableColNum] !== 0) {
              tableParameter["rowspan"][tableColNum] -= 1;
              tableColNum += 1;
            }
          }

          if (tableSubParameter["rowspan"] !== "") {
            const rowspanInt = Number(tableSubParameter["rowspan"]);
            if (rowspanInt > 1) tableParameter["rowspan"][tableColNum] = rowspanInt - 1;
          }

          if (!tableParameter["col"][tableColNum]) tableParameter["col"][tableColNum] = "";

          tableParameter["div"] += tableSubParameter["div"];
          tableParameter["class"] = tableSubParameter["class"] !== "" ? tableSubParameter["class"] : tableParameter["class"];
          tableParameter["table"] += tableSubParameter["table"];
          tableParameter["col"][tableColNum] += tableSubParameter["col"];

          if (tableSub[2] == "" && tableSub[3] == "") tableTrChange = 1;
          else {
            tableTrChange = 0;

            tableDataEnd +=
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

        tableDataEnd += "</tr>";
        tableDataEnd =
          '<table class="' + tableParameter["class"] + '" style="' + tableParameter["table"] + '">' + tableCaptionNew + tableDataEnd + "</table>";
        tableDataEnd = '<div class="table_safe" style="' + tableParameter["div"] + '">' + tableDataEnd + "</div>";

        this.wikiText = this.wikiText.replace(tableRegex, "\n<front_br>" + tableDataEnd + "<back_br>\n");
      }

      tableCountAll -= 1;
    }
  }

  // re.sub fix
  manageList() {
    const quoteRegex = /((?:\n&gt; *[^\n]*)+)\n/;
    let quoteCount = 0;
    let quoteCountMax = (this.wikiText.match(quoteRegex) || []).length * 10;
    while (true) {
      let quoteData = this.wikiText.match(quoteRegex);
      if (quoteCountMax < 0) break;
      else if (!quoteData) break;
      else {
        const quoteDataOriginal = quoteData[0];
        let quoteDataNew = quoteData[1];
        quoteDataNew = quoteDataNew.replace(/\n&gt; *(?<in>[^\n]*)/g, "$<in>\n").replace(/\n$/g, "");
        quoteDataNew = unescapeHtml(this.getToolDataRevert(quoteDataNew));

        this.dataInclude.push(...[[this.docInclude + "opennamu_quote_" + quoteCount, this.docName, quoteDataNew, ""]]);

        const dataName = this.getToolDataStorage('<div id="' + this.docInclude + "opennamu_quote_" + quoteCount + '"></div>', "", quoteDataOriginal);

        this.wikiText = this.wikiText.replace(
          quoteRegex,
          "\n<front_br><blockquote><back_br>\n<" + dataName + "></" + dataName + "><front_br></blockquote><back_br>\n"
        );
      }

      quoteCountMax -= 1;
      quoteCount += 1;
    }

    const handler = (match: string, p1: string, p2: string) => {
      const listData = p2;
      let listLen = p1.length;
      if (listLen === 0) listLen = 1;

      const listStyle: Record<number, string> = {
        1: "list-style: unset;",
        2: "list-style: circle;",
        3: "list-style: square;",
      };
      let listStyleData = "list-style: square;";
      if (listStyle[listLen]) listStyleData = listStyle[listLen];

      return '<li style="margin-left: ' + listLen * 20 + "px;" + listStyleData + '">' + listData + "</li>";
    };

    const listRegex = /((?:\n *\* ?[^\n]*)+)\n/;
    let listCountMax = (this.wikiText.match(listRegex) || []).length;
    while (true) {
      const listData = this.wikiText.match(listRegex);
      let listDataNew!: string;
      if (listCountMax < 0) break;
      else if (!listData) break;
      else {
        listDataNew = listData[1];
        const listSubRegex = /\n( *)\* ?([^\n]*)/g;

        listDataNew = listDataNew.replace(listSubRegex, handler);
        this.wikiText = this.wikiText.replace(new RegExp(listRegex, "gi"), '\n<front_br><ul class="opennamu_ul">' + listData + "</ul><back_br>\n");
      }

      listCountMax -= 1;
    }
  }

  // re.sub fix
  manageMacro() {
    // double macro function
    const manageMacroDouble = (match: string, p1: string, p2: string) => {
      const matchOriginal = match;
      const nameData = p1.toLowerCase();

      const macroSplitRegex = /(?:^|,) *([^,]+)/;
      const macroSplitSubRegex = /(^[^=]+) *= *([^=]+)/;

      if (["youtube", "nicovideo", "navertv", "kakaotv", "vimeo"].includes(nameData)) {
        const data = p2.match(macroSplitRegex) || [];
        console.log(data);
        // get option
        let videoCode = "";
        let videoStart = "";
        let videoEnd = "";
        let videoWidth = "640px";
        let videoHeight = "360px";
        for (const datum of data) {
          const dataSub = datum.match(macroSplitSubRegex);
          let dataSubNew!: string[];
          if (dataSub) {
            dataSubNew = [dataSub[1].toLowerCase(), dataSub[2]];

            if (dataSub[1] === "width") videoWidth = this.getToolPxAddCheck(dataSub[2]);
            else if (dataSub[1] === "height") videoHeight = this.getToolPxAddCheck(dataSub[2]);
            else if (dataSub[1] === "start") videoStart = dataSub[2];
            else if (dataSub[1] === "end") videoEnd = dataSub[2];
            else if (dataSub[1] === "https://www.youtube.com/watch?v" && nameData == "youtube") videoCode = dataSub[2];
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
        const data = p2.match(macroSplitRegex) || [];
        let mainText = "";
        let subText = "";
        let color = "";
        for (const datum of data) {
          const dataSub = datum.match(macroSplitSubRegex);
          let dataSubNew!: string[];

          if (dataSub) {
            dataSubNew = [dataSub[1].toLowerCase(), dataSub[2]];

            if (dataSub[1] === "ruby") subText = dataSub[2];
            else if (dataSub[1] === "color") color = dataSub[2];
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
        const mainText = this.getToolDataRevert(p2, "render");
        const dataName = this.getToolDataStorage('<span id="' + mainText + '">', "</span>", matchOriginal);
        return "<" + dataName + "></" + dataName + ">";
      } else if (nameData === "age") {
        // 정규 표현식으로 날짜 형식 검사
        let dataText = "";
        const datePattern = /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/;

        if (datePattern.test(p2)) {
          const date = new Date(p2);
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

        if (datePattern.test(p2)) {
          const date = new Date(p2);
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
        return "<macro>" + p1 + "(" + p2 + ")" + "</macro>";
      }
    };

    this.wikiText = this.wikiText.replace(/\[([^[(]+)\(([^()]+)\)\]/g, manageMacroDouble);

    const manageMacroSingle = (match: string, p1: string) => {
      const matchOriginal = match;
      p1 = p1.toLowerCase();

      if (["date", "datetime"].includes(p1)) {
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
      } else if (p1 === "br") {
        const dataName = this.getToolDataStorage("<br>", "", matchOriginal);
        return "<" + dataName + "></" + dataName + ">";
      } else if (p1 === "clearfix") {
        const dataName = this.getToolDataStorage('<div style="clear: both;"></div>', "", matchOriginal);
        return "<" + dataName + "></" + dataName + ">";
      } else if (["목차", "toc", "tableofcontents"].includes(p1)) {
        return "<toc_need_part>";
      } else if (p1 === "pagecount") {
        return String((this.database.data || []).length);
      } else {
        return `<macro>${p1}</macro>`;
      }
    };

    // single macro replace
    this.wikiText = this.wikiText.replace(/\[([^[\]]+)\]/g, manageMacroSingle);

    // macro safe restore
    this.wikiText = this.wikiText.replaceAll("<macro>", "[");
    this.wikiText = this.wikiText.replaceAll("</macro>", "]");
  }

  // re.sub fix
  manageLink() {
    const linkRegex = /\[\[((?:(?!\[\[|\]\]|\||<|>).|<slash_[0-9]+>)+)(?:\|((?:(?!\[\[|\]\]|\|).)+))?\]\]/;
    let linkCountAll = (this.wikiText.match(linkRegex) || []).length * 4;
    while (true) {
      if (!this.wikiText.match(linkRegex)) break;
      else if (linkCountAll < 0) {
        console.log("Error: render link count overflow");
        break;
      } else {
        // link split
        const linkData = this.wikiText.match(linkRegex) || [];
        const linkDataFull = linkData[0];
        let linkMain = linkData[1];
        let linkMainOriginal = linkMain;

        // file link
        if (linkMain.match(/^(파일|file|외부|out):/i)) {
          let fileWidth = "";
          let fileHeight = "";
          let fileAlign = "";
          let fileBgcolor = "";
          let fileTurn = "";

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
                }
              }
            }
          }

          linkMainOriginal = "";
          let linkSub = linkMain;
          let fileOut = 0;
          let linkExist!: string;
          let linkExtensionNew!: string;

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

            // 데이터베이스 쿼리 예시 (여기서는 가상의 구현)
            const dbData = this.database.data.find((value) => value.title === `file:${linkMain}`);
            if (dbData) {
              linkExist = "";
              this.dataBacklink.push([this.docName, "file:" + linkMain, "file"]);
            } else {
              linkExist = "opennamu_not_exist_link";
              this.dataBacklink.push([this.docName, "file:" + linkMain, "no"]);
              this.dataBacklink.push([this.docName, "file:" + linkMain, "file"]);
            }

            const linkExtensionRegex = /\.([^.]+)$/;
            const linkExtension = linkMain.match(linkExtensionRegex);
            if (linkExtension) {
              linkExtensionNew = linkExtension[1];
            } else {
              linkExtensionNew = "jpg";
            }

            linkMain = linkMain.replace(new RegExp(linkExtensionRegex, "g"), "");
            linkMainOriginal = linkMain;

            linkMain = "/image/" + urlPas(sha224Replace(linkMain)) + "." + linkExtension;
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

          // 이미지 태그 생성
          let fileEnd = `<img style="${fileWidth}${fileHeight}${fileAlignStyle}${fileBgcolor}" alt="${linkSub}" src="${linkMain}">`;
          if (fileAlign === "center") {
            fileEnd = `<div style="text-align:center;">${fileEnd}</div>`;
          }

          // 링크 존재 여부에 따른 처리
          if (linkExist !== "") {
            const dataName = this.getToolDataStorage(
              `<a class="${linkExist}" title="${linkSub}" href="/upload?name=${urlPas(linkMainOriginal)}">${linkSub}</a>`,
              "</a>",
              linkDataFull
            );
            this.wikiText = this.wikiText.replace(linkRegex, `<${dataName}></${dataName}>`);
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

            const dataName =
              filePass === 1
                ? fileOut === 0
                  ? this.getToolDataStorage(
                      '<a title="' + linkSub + '" href="/w/file:' + urlPas(linkMainOriginal) + "." + urlPas(linkExtensionNew) + '">' + fileEnd,
                      "</a>",
                      linkDataFull
                    )
                  : this.getToolDataStorage('<a title="' + linkSub + '" href="' + linkMain + '">' + fileEnd, "</a>", linkDataFull)
                : this.getToolDataStorage("", "", linkDataFull);

            this.wikiText = this.wikiText.replace(linkRegex, `<${dataName}></${dataName}>`);
          }
        }
        // category 처리
        if (/^(분류|category):/i.test(linkMain)) {
          linkMain = linkMain.replace(/^(분류|category):/gi, "");

          if (linkData[1]) {
            linkMain += linkData[1];
          }

          let categoryBlur = "";
          if (/#blur$/i.test(linkMain)) {
            linkMain = linkMain.replace(/#blur$/gi, "");
            categoryBlur = "opennamu_category_blur";
          }

          let linkSub = linkMain;

          linkMain = this.getToolDataRestore(linkMain, "slash");
          linkMain = unescapeHtml(linkMain);

          if (!this.dataCategoryList.includes(linkMain)) {
            this.dataCategoryList.push(linkMain);

            const dbData = this.database.data.find((value) => value.title === "category:" + linkMain);
            let linkExist!: string;
            if (dbData) {
              linkExist = "";
              this.dataBacklink.push([this.docName, "category:" + linkMain, "cat"]);
            } else {
              linkExist = "opennamu_not_exist_link";
              this.dataBacklink.push([this.docName, "category:" + linkMain, "no"]);
              this.dataBacklink.push([this.docName, "category:" + linkMain, "cat"]);
            }

            linkMain = urlPas(linkMain);

            if (this.dataCategory === "") {
              this.dataCategory = '<div class="opennamu_category">' + /*this.getToolLang("category")*/ "카테고리" + " : ";
            } else {
              this.dataCategory += " | ";
            }

            this.dataCategory += `<a class="${categoryBlur} ${linkExist}" title="${linkSub}" href="/w/category:${linkMain}">${linkSub}</a>`;
          }

          if (this.wikiText.includes(`\n${linkDataFull}\n`)) {
            this.wikiText = this.wikiText.replace(`\n${linkDataFull}\n`, "\n");
          } else {
            this.wikiText = this.wikiText.replace(linkRegex, "");
          }
        }
        // inter link 처리 (미구현/오픈나무 전용 문법)
        else if (/^(?:inter|인터):([^:]+):/i.test(linkMain)) {
          const linkInterRegex = /^(?:inter|인터):([^:]+):/i;

          const linkInterName = linkMain.match(linkInterRegex) || [];

          linkMain = linkMain.replace(new RegExp(linkInterRegex, "g"), "");
          const linkTitle = `${linkInterName[1]}:${linkMain}`;

          linkMain = linkMain.replace(/&#x27;/g, "<link_single>");
          const linkDataSharpRegex = /#([^#]+)$/;
          let linkDataSharp = linkMain.match(linkDataSharpRegex) || [];
          let linkDataSharpNew!: string;
          if (linkDataSharp.length === 0) {
            linkDataSharpNew = linkDataSharp[1];
            linkDataSharpNew = unescapeHtml(linkDataSharpNew);
            linkDataSharpNew = "#" + urlPas(linkDataSharpNew);
            linkMain = linkMain.replace(new RegExp(linkDataSharpRegex, "g"), "");
          } else {
            linkDataSharpNew = "";
          }

          linkMain = linkMain.replaceAll("<link_single>", "&#x27;");
          linkMain = this.getToolDataRestore(linkMain, "slash");
          linkMain = unescapeHtml(linkMain);
          linkMain = urlPas(linkMain);

          // curs.execute(dbChange("SELECT plus, plus_t FROM html_filter WHERE kind = 'inter_wiki' AND html = ?"), [linkInterName]);
          // const dbData = curs.fetchall();
          // if (dbData) {
          //   linkMain = dbData[0][0] + linkMain;

          //   let linkSub = linkData[1] || "";
          //   let linkSubStorage = linkSub ? "" : linkMainOrg.replace(linkInterRegex, "");

          //   let linkInterIcon = `${linkInterName}:`;
          //   if (dbData[0][1] !== "") {
          //     linkInterIcon = dbData[0][1];
          //   }

          //   linkSubStorage = linkInterIcon + linkSubStorage;
          //   const dataName = getToolDataStorage(
          //     `<a class="opennamu_link_inter" title="${linkTitle}" href="${linkMain}${linkDataSharp}">${linkSubStorage}</a>`,
          //     "",
          //     linkDataFull
          //   );
          //   renderData = renderData.replace(linkRegex, `<${dataName}>${linkSub}</${dataName}>`, 1);
          // } else {
          //   renderData = renderData.replace(linkRegex, "", 1);
          // }

          this.wikiText = this.wikiText.replace(linkRegex, "");
        }
        // out link 처리
        else if (/^https?:\/\//i.test(linkMain)) {
          linkMain = this.getToolDataRestore(linkMain, "slash");
          const linkTitle = linkMain;
          linkMain = unescapeHtml(linkMain);
          linkMain = linkMain.replace(/"/g, "&quot;");

          let linkSub = linkData[1] || "";
          const linkSubStorage = linkSub ? "" : linkMainOriginal;

          const dataName = this.getToolDataStorage(
            `<a class="opennamu_link_out" target="_blank" title="${linkTitle}" href="${linkMain}">${linkSubStorage}</a>`,
            "",
            linkDataFull
          );
          this.wikiText = this.wikiText.replace(linkRegex, `<${dataName}>${linkSub}</${dataName}>`);
        }
        // in link 처리
        else {
          if (linkMain === "../") {
            linkMain = this.docName.replace(/(\/[^/]+)$/g, "");
          } else if (/^\//.test(linkMain)) {
            linkMain = linkMain.replace(/^\//g, `${this.docName}/`);
          } else if (/^:(분류|category):/i.test(linkMain)) {
            linkMain = linkMain.replace(/^:(분류|category):/gi, "category:");
          } else if (/^:(파일|file):/i.test(linkMain)) {
            linkMain = linkMain.replace(/^:(파일|file):/gi, "file:");
          } else if (/^사용자:/i.test(linkMain)) {
            linkMain = linkMain.replace(/^사용자:/gi, "user:");
          }

          linkMain = linkMain.replace(/&#x27;/g, "<link_single>");
          const linkDataSharpRegex = /#([^#]+)$/;
          let linkDataSharp = linkMain.match(linkDataSharpRegex) || [];
          let linkDataSharpNew!: string;
          if (linkDataSharp.length !== 0) {
            linkDataSharpNew = linkDataSharp[1];
            linkDataSharpNew = unescapeHtml(linkDataSharpNew);
            linkDataSharpNew = "#" + urlPas(linkDataSharpNew);
            linkMain = linkMain.replace(new RegExp(linkDataSharpRegex, "g"), "");
          } else {
            linkDataSharpNew = "";
          }

          linkMain = linkMain.replaceAll("<link_single>", "&#x27;");
          linkMain = this.getToolDataRestore(linkMain, "slash");
          linkMain = unescapeHtml(linkMain);

          const linkTitle = escapeHtml(linkMain + linkDataSharp);
          let linkExist = "";
          if (linkMain !== "") {
            const dbData = this.database.data.find((value) => value.title === linkMain);
            if (!dbData) {
              this.dataBacklink.push([this.docName, linkMain, "no"]);
              this.dataBacklink.push([this.docName, linkMain, ""]);
              linkExist = "opennamu_not_exist_link";
            } else {
              this.dataBacklink.push([this.docName, linkMain, ""]);
            }
          }

          let linkSame = "";
          if (linkMain === this.docName && this.docInclude === "") {
            linkSame = "opennamu_same_link";
          }

          linkMain = urlPas(linkMain);
          if (linkMain !== "") {
            linkMain = "/w/" + linkMain;
          }

          let linkSub = linkData[1] || "";
          const linkSubStorage = linkSub ? "" : linkMainOriginal;

          const dataName = this.getToolDataStorage(
            `<a class="${linkExist} ${linkSame}" title="${linkTitle}" href="${linkMain}${linkDataSharp}">${linkSubStorage}</a>`,
            "",
            linkDataFull
          );
          this.wikiText = this.wikiText.replace(linkRegex, `<${dataName}>${linkSub}</${dataName}>`);
        }
      }

      linkCountAll -= 1;
    }
  }

  // re.sub fix
  manageFootnote() {
    let footnoteNum = 0;
    const footnoteRegex = /(?:\[\*((?:(?!\[\*|\]| ).)+)?(?: ((?:(?!\[\*|\]).)+))?\]|\[(각주|footnote)\])/i;
    let footnoteCountAll = (this.wikiText.match(footnoteRegex) || []).length * 4;

    while (true) {
      footnoteNum += 1;

      const footnoteData = footnoteRegex.exec(this.wikiText);
      if (footnoteCountAll < 0) {
        break;
      } else if (!footnoteData) {
        break;
      } else {
        const footnoteDataOriginal = footnoteData[0];
        const footnoteDataGroups = footnoteData.slice(1);

        if (footnoteDataGroups[2]) {
          this.wikiText = this.wikiText.replace(footnoteRegex, () => this.getToolFootnoteMake());
        } else {
          const footnoteNumStr = String(footnoteNum);

          let footnoteName = footnoteDataGroups[0] || footnoteNumStr;
          const footnoteNameAdd = footnoteDataGroups[0] ? ` (${footnoteNumStr})` : "";
          const footnoteTextData = footnoteDataGroups[1] || "";

          if (this.dataFootnote[footnoteName]) {
            this.dataFootnote[footnoteName]["list"].push(footnoteNumStr);
            const footnoteFirst = this.dataFootnote[footnoteName]["list"][0];

            const dataName = this.getToolDataStorage(
              `<sup><a fn_target="${this.docInclude}fn_${footnoteFirst}" id="${this.docInclude}rfn_${footnoteNumStr}" href="#${this.docInclude}fn_${footnoteFirst}">(${footnoteName} (${footnoteNumStr}))</a></sup>`,
              "",
              footnoteDataOriginal
            );

            this.wikiText = this.wikiText.replace(footnoteRegex, `<${dataName}></${dataName}>`);
          } else {
            this.dataFootnote[footnoteName] = {
              list: [footnoteNumStr],
              data: footnoteTextData,
            };

            const dataName = this.getToolDataStorage(
              `<sup><a fn_target="${this.docInclude}fn_${footnoteNumStr}" id="${this.docInclude}rfn_${footnoteNumStr}" href="#${this.docInclude}fn_${footnoteNumStr}">(${footnoteName}${footnoteNameAdd})</a></sup>`,
              "",
              footnoteDataOriginal
            );

            this.wikiText = this.wikiText.replace(footnoteRegex, `<${dataName}></${dataName}>`);
          }
        }

        footnoteCountAll -= 1;
      }
    }

    this.wikiText += "<footnote_category>";
    this.wikiText += this.getToolFootnoteMake();
  }

  // re.sub fix
  manageText() {
    // <b> function
    const doRenderTextBold = (match: string, ...groups: string[]) => {
      const data = groups[0];
      let dataName;

      const useBold = this.config.useBold || true;
      if (useBold) {
        dataName = this.getToolDataStorage("<b>", "</b>", match);
      } else {
        dataName = this.getToolDataStorage("", "", match);
      }

      return `<${dataName}>${data}</${dataName}>`;
    };

    // <b>
    this.wikiText = this.wikiText.replace(/&#039;&#039;&#039;((?:(?!&#039;&#039;&#039;).)+)&#039;&#039;&#039;/g, doRenderTextBold);

    // <i> function
    const doRenderTextItalic = (match: string, p1: string) => {
      const data = p1;
      const dataName = this.getToolDataStorage("<i>", "</i>", match);
      return `<${dataName}>${data}</${dataName}>`;
    };

    // <i>
    this.wikiText = this.wikiText.replace(/&#039;&#039;((?:(?!&#039;&#039;).)+)&#039;&#039;/g, doRenderTextItalic);

    // <u> function
    const doRenderTextUnder = (match: string, p1: string) => {
      const data = p1;
      const dataName = this.getToolDataStorage("<u>", "</u>", match);
      return `<${dataName}>${data}</${dataName}>`;
    };

    // <u>
    this.wikiText = this.wikiText.replace(/__((?:(?!__).)+)__/g, doRenderTextUnder);

    // <sup> function
    const doRenderTextSup = (match: string, p1: string) => {
      const data = p1;
      const dataName = this.getToolDataStorage("<sup>", "</sup>", match);
      return `<${dataName}>${data}</${dataName}>`;
    };

    // <sup>
    this.wikiText = this.wikiText.replace(/\^\^\^((?:(?!\^\^\^).)+)\^\^\^/g, doRenderTextSup);
    // <sup> 2
    this.wikiText = this.wikiText.replace(/\^\^((?:(?!\^\^).)+)\^\^/g, doRenderTextSup);

    // <sub> function
    const doRenderTextSub = (match: string, p1: string) => {
      const data = p1;
      const dataName = this.getToolDataStorage("<sub>", "</sub>", match);
      return `<${dataName}>${data}</${dataName}>`;
    };

    // <sub>
    this.wikiText = this.wikiText.replace(/,,,(?:(?!,,,).)+,,,/g, doRenderTextSub);
    // <sub> 2
    this.wikiText = this.wikiText.replace(/,(?:(?!,,).)+,/g, doRenderTextSub);

    // <s> function
    const doRenderTextStrike = (match: string, p1: string) => {
      const data = p1;
      let dataName;

      const useStrike = this.config.useStrike || true;
      if (useStrike) {
        dataName = this.getToolDataStorage("<s>", "</s>", match);
      } else {
        dataName = this.getToolDataStorage("", "", match);
      }
      return `<${dataName}>${data}</${dataName}>`;
    };

    // <s>
    this.wikiText = this.wikiText.replace(/--((?:(?!--).)+)--/g, doRenderTextStrike);
    // <s> 2
    this.wikiText = this.wikiText.replace(/~~((?:(?!~~).)+)~~/g, doRenderTextStrike);
  }

  // re.sub fix
  manageHr() {
    const hrRegex = /\n-{4,9}\n/;
    let hrCountMax = (this.wikiText.match(new RegExp(hrRegex, "g")) || []).length * 3;

    while (true) {
      const hrData = hrRegex.exec(this.wikiText);
      if (hrCountMax < 0) {
        break;
      } else if (!hrData) {
        break;
      } else {
        this.wikiText = this.wikiText.replace(hrRegex, "\n<front_br><hr><back_br>\n");
      }

      hrCountMax -= 1;
    }
  }

  // re.sub fix
  manageHeading() {
    let tocList = [];

    // make heading base
    const headingRegex = /\n((={1,6})(#?) ?([^\n]+))\n/;
    let headingCountAll = (this.wikiText.match(headingRegex) || []).length * 3;
    let headingStack = [0, 0, 0, 0, 0, 0];
    let headingCount = 0;

    while (true) {
      headingCount += 1;

      if (!headingRegex.exec(this.wikiText)) {
        break;
      } else if (headingCountAll < 0) {
        console.error("Error : render heading count overflow");
        break;
      } else {
        const headingData = headingRegex.exec(this.wikiText) || [];
        const headingDataOriginal = headingData[0];
        const headingDataGroups = headingData.slice(1);

        const headingDataLastRegex = / ?(#?={1,6}[^=]*)$/;
        const headingDataLast = headingDataGroups[3].match(headingDataLastRegex);
        let headingDataLastValue = headingDataLast ? headingDataLast[1] : "";

        const headingDataText = headingDataGroups[3].replace(new RegExp(headingDataLastRegex, "g"), "");

        const headingDataDiff = headingDataGroups[2] + headingDataGroups[1];
        if (headingDataDiff !== headingDataLastValue) {
          // front != back -> restore
          let headingDataAll = headingDataGroups[0];

          for (let forA = 6; forA >= 1; forA--) {
            const forAStr = forA.toString();
            const headingRestoreRegex = new RegExp(`^={${forAStr}}|={${forAStr}}$`, "g");

            headingDataAll = headingDataAll.replace(headingRestoreRegex, `<heading_${forAStr}>`);
          }

          this.wikiText = this.wikiText.replace(headingRegex, `\n${headingDataAll}\n`);
        } else {
          const headingLevel = headingDataGroups[1].length;
          const headingLevelStr = headingLevel.toString();

          headingStack[headingLevel - 1] += 1;
          for (let forA = headingLevel; forA < 6; forA++) {
            headingStack[forA] = 0;
          }

          const headingStackStr = headingStack.join(".").replace(/(\.0)+$/g, "");
          tocList.push(["", headingDataText]);

          this.renderDataJS += `
                    function opennamuHeadingFolding(data, element = '') {
                        let fol = document.getElementById(data);
                        if(fol.style.display === '' || fol.style.display === 'inline-block' || fol.style.display === 'block') {
                            document.getElementById(data).style.display = 'none';
                        } else {
                            document.getElementById(data).style.display = 'block';
                        }
                        
                        if(element !== '') {
                            console.log(element.innerHTML);
                            if(element.innerHTML !== '⊖') {
                                element.innerHTML = '⊖';
                            } else {
                                element.innerHTML = '⊕';
                            }
                        }
                    }\n
                `;

          let headingFolding = ["⊖", "block"];
          if (headingDataGroups[2]) {
            headingFolding = ["⊕", "none"];
          }

          const dataName = this.getToolDataStorage(
            `<h${headingLevelStr}>`,
            `<sub><a id="${this.docInclude}editLoad_${headingCount}" href="/edit_section/${headingCount}/${urlPas(this.docName)}">✎</a><a href="javascript:void(0);" onclick="javascript:opennamuHeadingFolding('${this.docInclude}opennamuHeading_${headingCount}', this);">${headingFolding[0]}</a></sub></h${headingLevelStr}>`,
            headingDataOriginal
          );

          const headingDataComplete = `\n<front_br>${headingCount !== 1 ? "</div>" : ""}<${dataName}><heading_stack>${headingStackStr}</heading_stack> ${headingDataText}</${dataName}><div id="${this.docInclude}opennamuHeading_${headingCount}" style="display: ${headingFolding[1]};"><back_br>\n`;

          this.wikiText = this.wikiText.replace(headingRegex, headingDataComplete);
        }
      }

      headingCountAll -= 1;
    }

    // heading id adjust
    const headingEndCount = (this.wikiText.match(/<heading_stack>/g) || []).length;
    for (let forA = 5; forA >= 0; forA--) {
      const headingEndStackRegex = new RegExp(`<heading_stack>${"0\\.".repeat(forA)}`, "g");

      const headingEndMatchCount = (this.wikiText.match(headingEndStackRegex) || []).length;
      if (headingEndMatchCount === headingEndCount) {
        this.wikiText = this.wikiText.replace(headingEndStackRegex, "<heading_stack>");
        break;
      }
    }

    // heading id -> inline id
    const headingIdRegex = /<heading_stack>([^<>]+)<\/heading_stack>/;
    const headingIdRegexGlobal = /<heading_stack>([^<>]+)<\/heading_stack>/g;

    let match;
    const results: RegExpExecArray[] = [];

    while ((match = headingIdRegexGlobal.exec(this.wikiText)) !== null) {
      results.push(match);
    }

    for (let index = 0; index < results.length; index++) {
      const result = results[index];
      const content = `<a href="#toc" id="s-${result[1]}">${result[1]}.</a>`
      this.wikiText = this.wikiText.replace(headingIdRegex, content)
      tocList[index][0] = result[1];
    }

    // not heading restore
    for (let forA = 1; forA <= 6; forA++) {
      const forAStr = forA.toString();
      const headingRestoreRegex = new RegExp(`<heading_${forAStr}>`, "g");
      this.wikiText = this.wikiText.replace(headingRestoreRegex, "=".repeat(forA));
    }

    // make toc
    let tocData = "";
    if (tocList.length === 0) {
      tocData = "";
    } else {
      tocData = `<div class="opennamu_TOC" id="toc"><span class="opennamu_TOC_title">${/*this.getToolLang('toc')*/ "목차"}</span><br>`;
    }

    for (const forA of tocList) {
      tocData += `<br>${'<span style="margin-left: 10px;"></span>'.repeat(forA[0].split(".").length - 1)}<span class="opennamu_TOC_list"><a href="#s-${forA[0]}">${forA[0]}. </a><toc_inside>${forA[1]}</toc_inside></span>`;
    }

    if (tocData !== "") {
      tocData += "</div>";
      this.dataToc = tocData;
      this.wikiText += `<toc_data>${tocData}</toc_data>`;
    } else {
      this.dataToc = "";
    }
  }

  finalize() {
    // add category
    if (this.docInclude === "") {
      if (this.dataCategory !== "") {
        let dataName = this.getToolDataStorage(this.dataCategory, "</div>", "");
        const useCategorySet = this.config.useCategorySet || true;

        if (useCategorySet) {
          if (/<footnote_category>/.test(this.wikiText)) {
            this.wikiText = this.wikiText.replace(/<footnote_category>/, `<hr><${dataName}></${dataName}>`);
          } else {
            this.wikiText += `<hr><${dataName}></${dataName}>`;
          }
        } else {
          this.wikiText = this.wikiText.replace(/<footnote_category>/, "");
          this.wikiText = `<${dataName}></${dataName}><hr class="main_hr">${this.wikiText}`;
        }
      } else {
        this.wikiText = this.wikiText.replace(/<footnote_category>/, "");
      }
    } else {
      this.wikiText = this.wikiText.replace(/<footnote_category>/, "");
    }

    // remove front_br and back_br
    this.wikiText = this.wikiText.replace(/\n?<front_br>/, "");
    this.wikiText = this.wikiText.replace(/<back_br>\n?/, "");

    // \n to <br>
    this.wikiText = this.wikiText.replace(/\n/g, "<br>");

    // <render_n> restore
    this.wikiText = this.getToolDataRestore(this.wikiText);

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

    this.wikiText = this.wikiText.replace(/(<a(?: [^<>]*)?>|<\/a>)/g, handlerALink);

    // add toc
    const handlerToc = (match: string, p1: string) => {
      let data = p1;
      data = data.replace(/<[^<>]*>/g, "");

      const headingRegex = /<h([1-6])>/;
      const headingData = headingRegex.exec(this.wikiText);
      if (headingData) {
        const headingLevel = headingData[1];
        this.wikiText = this.wikiText.replace(headingRegex, `<h${headingLevel} id="${data}">`);
      }

      return data;
    };
    
    if (this.dataToc !== "") {
      this.wikiText += "</div>";
      const tocSearchRegex = /<toc_data>((?:(?!<toc_data>|<\/toc_data>).)*)<\/toc_data>/;
      let tocDataOn = 0;

      const tocData = this.wikiText.match(tocSearchRegex) || [];
      let tocDataNew = tocData[1];
      this.dataToc = tocDataNew;
      this.dataToc = this.dataToc.replace(/<toc_inside>((?:(?!<toc_inside>|<\/toc_inside>).)*)<\/toc_inside>/g, handlerToc);

      const useTocSet = this.config.useTocSet || true;

      this.wikiText = this.wikiText.replace(new RegExp(tocSearchRegex), "");
      if (useTocSet) {
        if (this.wikiText.match(tocSearchRegex)) {
          tocDataOn = 1;
        }

        const tmpRegex = /<toc_need_part>/;
        for (let i = 0; i < 20; i++) {
          this.wikiText = this.wikiText.replace(tmpRegex, this.dataToc)
        }
        this.wikiText = this.wikiText.replace(/<toc_need_part>/g, "")
      } else {
        this.wikiText = this.wikiText.replace(/<toc_need_part>/g, "")
      }

      if (this.docInclude !== "" || this.wikiText.match(/<toc_no_auto>/) || useTocSet || tocDataOn === 1) {
        this.wikiText = this.wikiText.replace(/<toc_no_auto>/g, "")
      } else {
        this.wikiText = this.wikiText.replace(/(?<in><h[1-6] id="[^"]*">)/, `<br>${this.dataToc}$<in>`)
      }
    } else {
      this.wikiText = this.wikiText.replace(/<toc_need_part>/g, "")
      this.wikiText = this.wikiText.replace(/<toc_no_auto>/g, "")
    }

    const handlerFootnote = (match: string, p1: string) => {
      const findRegex = new RegExp('<footnote_title target="' + p1 + '">((?:(?!<footnote_title|<\/footnote_title>).)*)<\/footnote_title>');
      let findData = this.wikiText.match(findRegex);
      let findDataNew!: string;
      if (findData) {
        findDataNew = findData[1];
        findDataNew = findDataNew.replace(/<[^<>]*>/g, "")
      } else {
        findDataNew = "";
      }

      return '<a title="' + findDataNew + '"';
    }

    this.wikiText = this.wikiText.replace(/<a fn_target="([^"]+)"/, handlerFootnote);
  }

  parse() {
    this.manageRemark();
    this.manageIncludeDefault();
    this.manageMiddle();
    this.manageInclude();
    this.manageMath();
    this.manageTable();
    this.manageList();
    this.manageMacro();
    this.manageLink();
    this.manageFootnote();
    this.manageText();
    this.manageHr();
    this.manageHeading();
    console.log(this.dataTempStorage, this.dataTempStorageCount, this.dataInclude);

    this.finalize();
    return [this.wikiText, this.renderDataJS];
  }
}
