<script>
    const lastUpdated = "2025년 6월 7일";
    // 내용 (실제 서비스에 맞게 상세히 작성)
    const chatLogPolicyContent = `
    <h2>채팅 및 로그 데이터 수집·이용 동의 안내</h2>
    <p>저희 [사이트/서비스 이름]은(는) 서비스 개선 및 이용자 경험 향상을 위해 채팅 내용 및 서비스 이용 로그 데이터를 수집하고 이용할 수 있습니다. 본 안내를 통해 데이터 수집 및 이용에 대한 상세 내용을 알려드립니다.</p>

    <h3>1. 수집하는 데이터 항목</h3>
    <p>저희는 서비스 이용 과정에서 다음과 같은 데이터를 수집할 수 있습니다.</p>
    <ul>
        <li><strong>채팅 데이터:</strong> 채팅방 내의 텍스트, 이미지, 파일 등 이용자가 생성하는 모든 대화 내용</li>
        <li><strong>서비스 이용 로그:</strong> 접속 시간, IP 주소, 기기 정보, 브라우저 종류, 서비스 이용 기록 (클릭, 페이지 이동 등)</li>
        <li><strong>시스템 오류 로그:</strong> 서비스 오류 발생 시의 기술적 정보</li>
    </ul>

    <h3>2. 수집 및 이용 목적</h3>
    <p>수집된 데이터는 다음의 목적으로만 이용됩니다.</p>
    <ul>
        <li>서비스의 안정적인 운영 및 기능 개선 (오류 분석 및 해결)</li>
        <li>이용자 문의 응대 및 분쟁 해결</li>
        <li>부적절한 이용 (불법 행위, 약관 위반 등) 방지 및 제재</li>
        <li>서비스 맞춤형 기능 제공 및 추천 (동의 시)</li>
        <li>통계 분석을 통한 서비스 성능 개선 및 신규 기능 개발</li>
    </ul>
    <p><strong>참고:</strong> 채팅 내용은 익명화 또는 비식별화 처리되어 통계 분석에 활용될 수 있으며, 특정 개인을 식별할 수 있는 형태로 외부에 공개되지 않습니다.</p>

    <h3>3. 데이터 보유 및 이용 기간</h3>
    <p>수집된 데이터는 법령에 따른 의무를 준수하거나 서비스 목적 달성 시까지 보유하며, 이후 파기됩니다. (예: 채팅 기록은 [6개월] 보관 후 파기, 오류 로그는 [3개월] 보관 후 파기)</p>

    <h3>4. 동의 철회 및 거부</h3>
    <p>이용자는 데이터 수집 및 이용에 대한 동의를 언제든지 철회할 수 있습니다. 다만, 필수적인 서비스 제공에 필요한 데이터 수집에 동의하지 않을 경우 일부 서비스 이용이 제한될 수 있습니다. 동의 철회 및 문의는 [담당자 이메일 주소 또는 문의 채널]을 통해 가능합니다.</p>

    <p>최종 업데이트: ${lastUpdated}</p>
  `;
</script>

<svelte:head>
    <title>채팅 및 로그 수집 동의 - [사이트/서비스 이름]</title>
</svelte:head>

<div class="policy-container">
    {@html chatLogPolicyContent}
</div>

<style>
    .policy-container {
        max-width: 800px;
        margin: 40px auto;
        padding: 20px;
        background-color: #fff;
        border-radius: 8px;
        box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
        line-height: 1.8;
        color: #333;
    }
    h2 {
        color: #2c3e50;
        font-size: 2em;
        margin-top: 30px;
        margin-bottom: 15px;
        border-bottom: 2px solid #eee;
        padding-bottom: 5px;
    }
    h3 {
        color: #34495e;
        font-size: 1.5em;
        margin-top: 25px;
        margin-bottom: 10px;
    }
    p,
    ul {
        margin-bottom: 15px;
    }
    ul {
        list-style-type: disc;
        margin-left: 20px;
    }
</style>
