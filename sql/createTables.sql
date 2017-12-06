create table medication(
    id serial primary key,
    email text references users(email),
    name text,
    type text,
    dosage text,
    currentstreak integer,
    longeststreak integer
);
