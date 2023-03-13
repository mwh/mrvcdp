import * as allTypes from './functions/types.js';

export function csvToObjectOfArrays(csvText : string) : { columns: Array<{type : allTypes.Type, name : string}>, data: { [key: string]: Array<any> } } {
    let lines = csvText.split("\n");
    let headers = lines[0].replace('\r', '').split(",");
    let result : { [key: string]: Array<any> } = {};
    for (let header of headers) {
        result[header] = new Array<any>();
    }
    for (let i = 1; i < lines.length; i++) {
        let line = lines[i];
        let values = line.split(",");
        for (let j = 0; j < values.length; j++) {
            let value = values[j];
            let header = headers[j];
            result[header].push(value);
        }
    }
    // Convert any columns where all values are numbers to numbers
    let types = new Array<{type : allTypes.Type, name : string}>();
    for (let header of headers) {
        let allNumbers = true;
        let allInts = true;
        for (let value of result[header]) {
            let n = Number(value);
            if (isNaN(n)) {
                allNumbers = false;
                break;
            }
            if (n % 1 != 0) {
                allInts = false;
            }
        }
        if (allNumbers) {
            for (let i = 0; i < result[header].length; i++) {
                result[header][i] = Number(result[header][i]);
            }
            if (allInts)
                types.push({type: allTypes.int, name : header});
            else
                types.push({type: allTypes.float, name : header});
        } else {
            types.push({ type: allTypes.string, name : header });
        }
    }
    return { columns : types, data: result };
}

export function tsvToObjectOfArrays(tsvText : string) : { columns: Array<{type : allTypes.Type, name : string}>, data: { [key: string]: Array<any> } } {
    let lines = tsvText.split("\n");
    let headers = lines[0].replace('\r', '').split("\t");
    let result : { [key: string]: Array<any> } = {};
    for (let header of headers) {
        result[header] = new Array<any>();
    }
    for (let i = 1; i < lines.length; i++) {
        let line = lines[i];
        let values = line.split("\t");
        for (let j = 0; j < values.length; j++) {
            let value = values[j];
            let header = headers[j];
            result[header].push(value);
        }
    }
    // Convert any columns where all values are numbers to numbers
    let types = new Array<{type : allTypes.Type, name : string}>();
    for (let header of headers) {
        let allNumbers = true;
        let allInts = true;
        for (let value of result[header]) {
            let n = Number(value);
            if (isNaN(n)) {
                allNumbers = false;
                break;
            }
            if (n % 1 != 0) {
                allInts = false;
            }
        }
        if (allNumbers) {
            for (let i = 0; i < result[header].length; i++) {
                result[header][i] = Number(result[header][i]);
            }
            if (allInts)
                types.push({type: allTypes.int, name : header});
            else
                types.push({type: allTypes.float, name : header});
        } else {
            types.push({ type: allTypes.string, name : header });
        }
    }
    return { columns : types, data: result };
}

