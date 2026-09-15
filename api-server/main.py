from flask import Flask, jsonify

app = Flask(__name__)

@app.route("/")
def hello_world():
    return jsonify({"message": "Hello, World!", "0": "end", "arr": ["London", "British", "Dublin"]})

if __name__ == '__main__':
    # サーバーを起動（デバッグモードON）
    app.run(debug=True)