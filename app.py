import requests

url = "https://api.siliconflow.cn/v1/chat/completions"

payload = {
    "messages": [
        {
            "content": "what can you do?",
            "role": "user"
        }
    ],
    "model": "deepseek-ai/DeepSeek-V3"
}
headers = {
    "Authorization": "Bearer sk-pekekxqtsbnqalbderhqvwpgpshbnmxtekmpbkpjbyagoqti",
    "Content-Type": "application/json"
}

response = requests.request("POST", url, json=payload, headers=headers)

print(response)
