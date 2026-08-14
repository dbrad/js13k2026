import fs from "fs";
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const version_file = __dirname + "/../../VERSION.txt";

const data = fs.readFileSync(version_file);
const version = data.toString();
const [year, month, day, deploy] = version.split(".");

const today = new Date();
const tYear = "" + today.getFullYear();
const tMonth = ("" + (today.getMonth() + 1)).padStart(2, "0");
const tDay = ("" + today.getDate()).padStart(2, "0");

let newTag;
if (tYear !== year || tMonth !== month || tDay !== day)
{
    newTag = `${tYear}.${tMonth}.${tDay}.001`;
}
else
{
    let d = ("" + (Number(deploy) + 1)).padStart(3, "00");
    newTag = `${year}.${month}.${day}.${d}`;
}

fs.writeFileSync(version_file, newTag);