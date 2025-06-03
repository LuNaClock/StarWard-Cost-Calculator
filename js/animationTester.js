export async function runAnimationTest() {
    const results = [];
    const hpPulseResult = await testHpPulseAnimation();
    results.push({ name: 'hpPulse', success: hpPulseResult });
    const summary = results.map(r => `${r.name}: ${r.success ? '成功' : '失敗'}`).join('\n');
    alert(`アニメーションテスト結果:\n${summary}`);
}

function testHpPulseAnimation() {
    return new Promise(resolve => {
        const testDiv = document.createElement('div');
        testDiv.className = 'hp-bar-fill hp-bar-low-pulse';
        testDiv.style.width = '100px';
        testDiv.style.height = '10px';
        testDiv.style.position = 'absolute';
        testDiv.style.left = '-9999px';
        document.body.appendChild(testDiv);
        const animations = testDiv.getAnimations();
        if (animations.length === 0) {
            document.body.removeChild(testDiv);
            resolve(false);
            return;
        }
        const anim = animations[0];
        const startTime = anim.currentTime;
        setTimeout(() => {
            const running = anim.currentTime > startTime;
            document.body.removeChild(testDiv);
            resolve(running);
        }, 250);
    });
}
