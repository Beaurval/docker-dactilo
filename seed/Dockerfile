FROM mongo

COPY init.json /init.json
CMD mongoimport --host mongodb --db dactilocontest --collection words --type json --file /init.json --jsonArray
