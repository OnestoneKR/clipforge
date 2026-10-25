# ClipForge — 브라우저 영상 편집기 (iPhone 지원)

파일: index.html · style.css · app.js · sw.js · manifest.webmanifest · icon-*.png (빌드 불필요)

## 데스크톱에서 실행
`python3 -m http.server 8000` → Chrome/Edge 에서 http://localhost:8000

## 아이폰(iPhone 12 Pro)에서 쓰기
폰은 이 PC의 localhost 에 접속할 수 없으므로 HTTPS 정적 호스팅에 올려야 합니다.
1. 이 폴더 전체를 Netlify Drop(app.netlify.com/drop)에 끌어다 놓거나 GitHub Pages 에 올립니다.
2. 아이폰 Safari 로 발급된 https 주소를 엽니다.
3. 공유 버튼 → "홈 화면에 추가" → 앱처럼 실행됩니다.
- 마이크 녹음·서비스 워커·공유 시트는 HTTPS 에서만 동작합니다.
- 내보내기 후 나오는 "저장 / 공유" 버튼 → "비디오 저장" 으로 사진 앱에 저장합니다.
- 내보내는 동안 화면을 켜 두고 앱을 전환하지 마세요.
- iOS 는 저장 공간을 오래 안 쓰면 비울 수 있으니 "프로젝트 저장" 으로 백업하세요.
