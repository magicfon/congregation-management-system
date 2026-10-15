import assert from 'node:assert/strict'
import { legacyVersion, previewVersion, sameContent, versionColor, fieldKey, localDate, validatePalette } from '../src/lib/midweek-versions'
import type { Meeting } from '../src/lib/midweek'
const base: Meeting = { date:'2026-10-16',start:'19:30',reading:'閱讀',chair:'甲',note:'',noteHighlight:'',items:[
  {id:'a',section:'ministry',title:'初次交談',minutes:3,counsel:1,role:'學生/助手',person:'乙',assistant:'丙',highlight:''},
  {id:'b',section:'living',title:'演講',minutes:10,counsel:0,role:'',person:'丁',assistant:'',highlight:''},
] }
const first = previewVersion(base)
assert.equal(first.number,1); assert.deepEqual(first.marks,{})
const changed=structuredClone(base); changed.items[0].assistant='戊'; changed.items[0].minutes=8
const second=previewVersion(changed,first)
assert.equal(second.number,2)
assert.equal(second.marks[fieldKey('a','assistant')],2)
assert.equal(second.marks[fieldKey('a','person')],undefined)
assert.equal(second.marks[fieldKey('b','at')],2)
assert.equal(second.marks[fieldKey('a','at')],undefined)
const thirdMeeting=structuredClone(changed);thirdMeeting.chair='';thirdMeeting.items[0].title='新名稱'
const third=previewVersion(thirdMeeting,second)
assert.equal(third.marks.chair,3)
assert.equal(third.marks[fieldKey('a','assistant')],2)
assert.equal(third.marks[fieldKey('a','title')],3)
assert.equal(previewVersion(changed,second).number,2)
assert(sameContent(changed,second.meeting))
const legacy=structuredClone(base);legacy.items[0].personHighlight='green'
assert.equal(legacyVersion(legacy).number,3)
assert.equal(legacyVersion(legacy).date,null)
assert.equal(legacyVersion(base).number,1)
assert.equal(versionColor(3,{'3':'#abcdef'}),'#abcdef')
assert.equal(versionColor(1),undefined)
assert.equal(localDate(new Date('2026-10-15T16:30:00Z')),'2026-10-16')
assert.throws(()=>validatePalette({'2':'url(evil)'}))
const removed=structuredClone(changed);removed.items.splice(0,1)
assert(!sameContent(removed,changed))
assert.equal(previewVersion(removed,second).marks[fieldKey('a','assistant')],undefined)
const added=structuredClone(changed);added.items.push({...base.items[1],id:'c',person:'',assistant:''})
assert.equal(previewVersion(added,second).marks[fieldKey('c','person')],undefined)
console.log('版次：獨立欄位、累積顏色、時間順延、無變更、既有初始化、刪除及台北日期通過')
