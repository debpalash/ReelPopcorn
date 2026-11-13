import {test,expect} from 'nsh/test';
import {parseSubtitles,indexReference,alignTranscript} from './alignment';
test('preserves identical dialogue repeated later in the title so it remains ambiguous',()=>{
 const cues=parseSubtitles('WEBVTT\n\n00:01.000 --> 00:03.000\nPlease come home now.\n\n01:01.000 --> 01:03.000\nPlease come home now.');
 expect(cues.length).toBe(2);
});
test('bounds a match to supported dialogue instead of filling an unmatched compilation',()=>{
 const reference=[0,10,20].map((start,index)=>({start:100+start,end:104+start,text:['the first train is leaving for the coast tonight','take your brother and wait outside the old station','we have never been this far away from home'][index]}));
 const captions=[...reference.map(cue=>({...cue,start:cue.start-100,end:cue.end-100})),...Array.from({length:12},(_,i)=>({start:40+i*10,end:44+i*10,text:'an entirely unrelated line from another scene altogether'}))];
 expect(alignTranscript(indexReference(reference),captions,'aqz-KE-bpKQ',160,600)).toMatchObject({movieStart:100,videoStart:0,videoEnd:24});
});
test('requires dialogue from at least three distinct reference cues',()=>{
 const text='we must leave before morning and take the last train to the city where our friends are waiting for us';
 const reference=[{start:100,end:130,text}];
 const captions=text.split(' ').reduce((all,word,index)=>{const at=Math.floor(index/6);all[at]??={start:at*5,end:at*5+5,text:''};all[at].text+=(all[at].text?' ':'')+word;return all;},[] as {start:number;end:number;text:string}[]);
 expect(alignTranscript(indexReference(reference),captions,'aqz-KE-bpKQ',30,600)).toBe(null);
});
