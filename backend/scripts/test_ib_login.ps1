$headers = @{ 'Content-Type' = 'application/json' }
$body = @{ email = 'ib2@gmail.com'; password = 'Password123!' } | ConvertTo-Json
$response = Invoke-RestMethod -Method Post -Uri 'http://localhost:3001/api/auth/login' -Headers $headers -Body $body
$response