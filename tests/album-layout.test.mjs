import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import ts from 'typescript';

test('memo ink is vertically centered for single and multiple lines', async () => {
  const source=await readFile(new URL('../src/lib/album-image.ts',import.meta.url),'utf8');
  for (const memo of ['치우의 하루 🐾','첫째 줄\n둘째 줄']) {
    const drawn=[], boxes=[];
    let lastBox;
    const ctx={ textBaseline:'top', font:'', fillStyle:'', beginPath(){}, roundRect(...args){lastBox=args;}, fill(){boxes.push(lastBox);},
      measureText(value){return {width:value.length*12,actualBoundingBoxAscent:this.textBaseline==='alphabetic'?22:-2,actualBoundingBoxDescent:6};},
      fillText(value,x,y){drawn.push({value,x,y,baseline:this.textBaseline});},
    };
    const exports={};
    vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{
      exports,require:()=>({albumDate:value=>value,careLabels:()=>[]}),
      document:{fonts:{load:async()=>[{}]},createElement:()=>({width:0,height:0,getContext:()=>ctx,toBlob:fn=>fn(new Blob())})},Blob,
    });
    await exports.dailyImage({date:'2026-10-02',memo,photo_url:null,poop_count:2,sleep_well:true,walked:false});
    const memoBox=boxes.find(box=>box?.[0]===68 && box[2]===944 && box[3]===memo.split('\n').length*48+48);
    assert.ok(memoBox);
    const lines=drawn.filter(item=>memo.split('\n').includes(item.value));
    assert.equal(lines.length,memo.split('\n').length);
    const inkTop=lines[0].y-22,inkBottom=lines.at(-1).y+6;
    assert.equal((inkTop+inkBottom)/2,memoBox[1]+memoBox[3]/2);
    assert.ok(lines.every(line=>line.baseline==='alphabetic'));
  }
});
