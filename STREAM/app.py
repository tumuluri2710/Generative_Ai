from flask import  Flask,render_template,jsonify,request
from response import gen_res
app=Flask(__name__)
@app.route('/')
def index():
    return render_template('index.html')
@app.route('/chat', methods=['POST'])
def chat():
    user_input = request.json.get('message')
    print(user_input)
    # Here you can process the input as needed
    response=gen_res()
    return jsonify({'response': response})

if __name__ == '__main__':
    app.run(host="localhost",port=8080,debug=True)