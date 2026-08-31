<!-- Test Task 1 -->
<!-- WN-1.. -->
Invoke-WebRequest -Uri "http://localhost:3000/api/newsletter" -Method POST -Body '{"email":"yogi@robotostudio.com"}' -ContentType "application/json" | Select-Object StatusCode, StatusDescription, Content

<!-- PSN -->
curl.exe -i -X POST "http://localhost:3000/api/newsletter" -H "Content-Type: application/json" -d "{\"email\":\"yogi@robotostudio.com\"}"

