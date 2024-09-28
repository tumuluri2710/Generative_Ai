def gen_res():
    with  open('example.txt' ,'r') as f:
        x=f.read()
        return x
        
       
print(str(gen_res()))
   