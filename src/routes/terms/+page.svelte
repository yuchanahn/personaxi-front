<script>
    const lastUpdated = "2025년 6월 7일";
    // 이용약관 내용 (실제 내용은 훨씬 길게 작성해야 함)
    const termsContent = `
    <h2>이용약관</h2>
    <p>본 약관은 [사이트/서비스 이름] (이하 "회사")에서 제공하는 모든 서비스의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임 사항, 기타 필요한 사항을 규정함을 목적으로 합니다.</p>

    <h3>1. 약관의 효력 및 변경</h3>
    <p>본 약관은 서비스 화면에 게시하거나 기타의 방법으로 회원에게 공지함으로써 효력이 발생합니다. 회사는 "약관의 규제에 관한 법률", "정보통신망 이용촉진 및 정보보호 등에 관한 법률" 등 관련 법령을 위배하지 않는 범위에서 본 약관을 개정할 수 있습니다.</p>

    <h3>2. 회원의 의무</h3>
    <p>회원은 다음 각 호의 행위를 하여서는 안 됩니다.</p>
    <ul>
        <li>다른 회원의 ID 및 비밀번호를 도용하는 행위</li>
        <li>회사 서비스의 운영을 방해하는 행위</li>
        <li>공서양속에 위반되는 저속, 음란한 내용의 정보 등을 유포하는 행위</li>
        <li>기타 관계 법령에 위배되는 행위</li>
    </ul>

    <h3>3. 서비스 이용 제한</h3>
    <p>회원이 본 약관의 의무를 위반하거나 서비스의 정상적인 운영을 방해한 경우, 회사는 서비스 이용을 제한하거나 회원 자격을 상실시킬 수 있습니다.</p>

    <h3>4. 책임의 한계</h3>
    <p>회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.</p>

    <p>최종 업데이트: ${lastUpdated}</p>
  `;
</script>

<svelte:head>
    <title>이용약관 - [사이트/서비스 이름]</title>
</svelte:head>

<div class="terms-container">
    {@html termsContent}
</div>

<style>
    .terms-container {
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
