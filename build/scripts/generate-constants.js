const fs = require('fs');

const data = fs.readFileSync("src/.meta/CONSTANTS", 'utf8');
const sets = data.split("\n\n").map(set => set.split("\n"));

let jsFile = "// GENERATED CONSTANTS\nexport const DEFINITIONS = {";
let dtsFile = "// GENERATED CONSTANTS";
for (const set of sets)
{
    jsFile += `\n`;
    dtsFile += `\n`;
    let index = 0;
    for (const entry of set)
    {
        let [constant, value] = entry.split("=");
        if (value !== undefined && value !== null)
        {
            jsFile += `    ${constant}: '${value}',\n`;
            dtsFile += `declare const ${constant}: ${value};\n`;
        }
        else
        {
            jsFile += `    ${entry}: '${index}',\n`;
            dtsFile += `declare const ${entry}: ${index};\n`;
        }

        index++;
    }
}
jsFile += "};";

fs.writeFileSync('build/constants/constants.mjs', jsFile);
fs.writeFileSync('build/constants/constants.d.ts', dtsFile);