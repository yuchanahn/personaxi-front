import{f as Z,a as ee}from"../chunks/RqNsGTga.js";import"../chunks/CK28d8Rm.js";import{a as te}from"../chunks/BZzC-nUB.js";import{p as ie,ah as a,aw as ae,a as se,s as r,m as u,aC as ne,az as i,Q as oe,g as o,ai as s,aE as re}from"../chunks/CiUeti6J.js";import{s as v}from"../chunks/BwnzCjf-.js";import{h as de}from"../chunks/BO4nq_ZU.js";import{e as b}from"../chunks/BCN6b5dV.js";import{b as le}from"../chunks/ACrpVJ7P.js";import{i as ce}from"../chunks/BnblD5CO.js";var ve=Z(`<div class="page svelte-xsv3xy"><div class="panel svelte-xsv3xy"><div class="eyebrow svelte-xsv3xy">/test/pip</div> <h1 class="svelte-xsv3xy">떠있는 미니 바 데모</h1> <p class="desc svelte-xsv3xy">이건 브라우저가 화면공유 때 띄우는 특권 UI 자체는 아니고, 웹에서 제일 비슷하게 만들 수
            있는 <code class="svelte-xsv3xy">Document Picture-in-Picture</code> 데모입니다.</p> <div class="actions svelte-xsv3xy"><button class="action action--primary svelte-xsv3xy">미니 바 열기</button> <button class="action svelte-xsv3xy">닫기</button></div> <div class="status-box svelte-xsv3xy"><div><strong>지원 여부</strong> </div> <div><strong>상태</strong> </div> <div><strong>열림</strong> </div></div> <ul class="notes svelte-xsv3xy"><li>Chrome/Edge 계열에서만 기대하는 게 맞습니다.</li> <li>일반 웹페이지 DOM이 아니라 별도 PiP 창으로 뜹니다.</li> <li>이 안에 HTML, 버튼, canvas, Live2D 캔버스도 넣을 수는 있습니다.</li> <li>다만 화면공유 컨트롤 바 자체처럼 브라우저 특권 UI를 그대로 복제하는 건 아닙니다.</li></ul> <hr class="svelte-xsv3xy"/> <h2 class="svelte-xsv3xy">gifcap 방식 확인</h2> <p class="desc svelte-xsv3xy">아래 버튼은 <code class="svelte-xsv3xy">getDisplayMedia()</code>를 직접 호출합니다. 이걸 누르면 gifcap처럼
            브라우저가 자기 공유 컨트롤 바를 띄워야 합니다.</p> <div class="actions svelte-xsv3xy"><button class="action action--primary svelte-xsv3xy">화면공유 시작</button> <button class="action svelte-xsv3xy">화면공유 중지</button></div> <div class="status-box svelte-xsv3xy"><div><strong>지원 여부</strong> </div> <div><strong>상태</strong> </div> <div><strong>stream</strong> </div></div> <div class="preview-frame svelte-xsv3xy"><video autoplay playsinline="" class="svelte-xsv3xy"></video></div></div></div>`,2);function he(H,U){ie(U,!1);let M=u("대기 중"),x=u(!1),n=null,S=u("대기 중"),l=u(null),p=u(null);function E(){return window.documentPictureInPicture}function d(e){r(M,e)}function c(e){r(S,e)}function L(){return typeof navigator.mediaDevices?.getDisplayMedia=="function"}function V(e){const t=e.document;t.body.innerHTML=`
            <div class="mini-bar" role="dialog" aria-label="떠있는 미니 바">
                <div class="mini-bar__left">
                    <div class="mini-bar__dot"></div>
                    <div class="mini-bar__copy">
                        <strong>PersonaXi Mini Bar</strong>
                        <span>브라우저 밖에 뜨는 Document PiP 데모</span>
                    </div>
                </div>
                <div class="mini-bar__actions">
                    <button class="mini-bar__button mini-bar__button--ghost" data-action="ping" type="button">
                        핑
                    </button>
                    <button class="mini-bar__button mini-bar__button--primary" data-action="close" type="button">
                        닫기
                    </button>
                </div>
            </div>
        `;const B=t.createElement("style");B.textContent=`
            :root {
                color-scheme: dark;
            }

            html, body {
                margin: 0;
                width: 100%;
                height: 100%;
                overflow: hidden;
                background: transparent;
                font-family: Inter, "Segoe UI", system-ui, sans-serif;
            }

            body {
                display: flex;
                align-items: stretch;
                justify-content: stretch;
                padding: 0;
            }

            .mini-bar {
                box-sizing: border-box;
                display: flex;
                align-items: center;
                justify-content: space-between;
                gap: 12px;
                width: 100%;
                height: 100%;
                padding: 10px 12px;
                border: 1px solid rgba(255,255,255,.12);
                border-radius: 16px;
                background: linear-gradient(180deg, rgba(24,27,36,.98), rgba(14,17,24,.98));
                color: #f4f7fb;
                box-shadow:
                    0 12px 24px rgba(0,0,0,.32),
                    inset 0 1px 0 rgba(255,255,255,.04);
            }

            .mini-bar__left {
                display: flex;
                align-items: center;
                gap: 10px;
                min-width: 0;
                flex: 1 1 auto;
            }

            .mini-bar__dot {
                flex: 0 0 auto;
                width: 10px;
                height: 10px;
                border-radius: 999px;
                background: #34d399;
                box-shadow: 0 0 16px rgba(52, 211, 153, .65);
            }

            .mini-bar__copy {
                display: flex;
                flex-direction: column;
                min-width: 0;
            }

            .mini-bar__copy strong {
                font-size: 13px;
                line-height: 1.2;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .mini-bar__copy span {
                font-size: 11px;
                line-height: 1.3;
                color: rgba(244,247,251,.66);
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
            }

            .mini-bar__actions {
                display: flex;
                align-items: center;
                gap: 8px;
                flex: 0 0 auto;
            }

            .mini-bar__button {
                appearance: none;
                -webkit-appearance: none;
                min-height: 34px;
                padding: 0 12px;
                border-radius: 10px;
                border: 1px solid rgba(255,255,255,.12);
                color: #f4f7fb;
                font-size: 12px;
                font-weight: 700;
                cursor: pointer;
            }

            .mini-bar__button--ghost {
                background: rgba(255,255,255,.06);
            }

            .mini-bar__button--primary {
                background: linear-gradient(180deg, #3b82f6, #2563eb);
                border-color: rgba(59,130,246,.45);
            }
        `,t.head.innerHTML="",t.head.appendChild(B),t.body.querySelector('[data-action="ping"]')?.addEventListener("click",()=>{window.dispatchEvent(new CustomEvent("pip-demo-message",{detail:"핑 버튼 눌림"}))}),t.body.querySelector('[data-action="close"]')?.addEventListener("click",()=>{e.close()})}async function W(){const e=E();if(!e){d("이 브라우저는 Document PiP를 지원하지 않음");return}if(n&&!n.closed){n.focus(),d("이미 떠 있음");return}try{const t=await e.requestWindow({width:460,height:86,disallowReturnToOpener:!0});n=t,r(x,!0),V(t),d("미니 바 열림"),t.addEventListener("pagehide",()=>{n=null,r(x,!1),d("미니 바 닫힘")})}catch(t){console.error(t),d("열기 실패")}}function A(){if(!n||n.closed){d("닫을 창 없음");return}n.close()}function m(e){o(p)&&re(p,o(p).srcObject=e)}function $(e=!0){o(l)?.getTracks().forEach(t=>t.stop()),r(l,null),m(null),e&&c("화면공유 중지됨")}async function Q(){if(!L()){c("이 브라우저는 getDisplayMedia를 지원하지 않음");return}if(o(l)){c("이미 화면공유 중");return}try{const e=await navigator.mediaDevices.getDisplayMedia({video:!0,audio:!1});r(l,e),m(e),c("화면공유 시작됨");const[t]=e.getVideoTracks();t?.addEventListener("ended",()=>{r(l,null),m(null),c("브라우저/사용자에 의해 화면공유 종료됨")})}catch(e){console.error(e),c("화면공유 시작 실패 또는 취소")}}window.addEventListener("pip-demo-message",e=>{d(e.detail)}),te(()=>{$(!1),n&&!n.closed&&n.close()}),ce();var g=ve();de(e=>{ne.title="Document PiP Test"});var T=a(g),f=i(a(T),6),z=a(f),R=i(z,2);s(f);var y=i(f,2),_=a(y),X=i(a(_));s(_);var h=i(_,2),F=i(a(h));s(h);var C=i(h,2),G=i(a(C));s(C),s(y);var w=i(y,10),I=a(w),J=i(I,2);s(w);var P=i(w,2),k=a(P),K=i(a(k));s(k);var D=i(k,2),N=i(a(D));s(D);var q=i(D,2),Y=i(a(q));s(q),s(P);var O=i(P,2),j=a(O);j.muted=!0,le(j,e=>r(p,e),()=>o(p)),s(O),s(T),s(g),ae((e,t)=>{v(X,`: ${e??""}`),v(F,`: ${o(M)??""}`),v(G,`: ${o(x)?"yes":"no"}`),v(K,`: ${t??""}`),v(N,`: ${o(S)??""}`),v(Y,`: ${o(l)?"active":"none"}`)},[()=>E()?"지원됨":"지원 안 됨",()=>L()?"지원됨":"지원 안 됨"],oe),b("click",z,W),b("click",R,A),b("click",I,Q),b("click",J,()=>$()),ee(H,g),se()}export{he as component};
