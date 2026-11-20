const test=require('node:test'),assert=require('node:assert/strict');
const {isWebtorUrl,isWebtorVideoUrl}=require('../src/js/webtor-provider');
test('Webtor provider accepts canonical HTTPS pages and rejects hostile URL forms',()=>{
    const hash='a'.repeat(40);
    assert.equal(isWebtorUrl('https://webtor.io/'),true);
    assert.equal(isWebtorVideoUrl('https://webtor.io/'),false);
    assert.equal(isWebtorVideoUrl(`https://webtor.io/${hash}?file=%2FSeason%2FEpisode02.mkv`),true);
    assert.equal(isWebtorVideoUrl('https://webtor.io/stream-video'),false);
    for(const url of [`https://webtor.io.evil.example/${hash}`,`http://webtor.io/${hash}`,`https://user:password@webtor.io/${hash}`,`https://webtor.io:9000/${hash}`])assert.equal(isWebtorUrl(url),false);
});
